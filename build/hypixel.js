"use strict";
/**
 * Fetch the clean Hypixel API
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchMemberProfilesUncached = exports.fetchBasicProfileFromUuidUncached = exports.fetchMemberProfileUncached = exports.fetchMemberProfile = exports.fetchUser = exports.sendCleanApiRequest = exports.maxMinion = exports.saveInterval = void 0;
const profile_1 = require("./cleaners/skyblock/profile");
const database_1 = require("./database");
const hypixelApi_1 = require("./hypixelApi");
const profiles_1 = require("./cleaners/skyblock/profiles");
const player_1 = require("./cleaners/player");
const cached = __importStar(require("./hypixelCached"));
const _1 = require(".");
// the interval at which the "last_save" parameter updates in the hypixel api, this is 3 minutes
exports.saveInterval = 60 * 3 * 1000;
// the highest level a minion can be
exports.maxMinion = 11;
/** Sends an API request to Hypixel and cleans it up. */
async function sendCleanApiRequest({ path, args }, included, options) {
    const key = await hypixelApi_1.chooseApiKey();
    const rawResponse = await hypixelApi_1.sendApiRequest({ path, key, args });
    if (rawResponse.throttled) {
        // if it's throttled, wait a second and try again
        await new Promise(resolve => setTimeout(resolve, 1000));
        return await sendCleanApiRequest({ path, args }, included, options);
    }
    // clean the response
    return await cleanResponse({ path, data: rawResponse }, options !== null && options !== void 0 ? options : {});
}
exports.sendCleanApiRequest = sendCleanApiRequest;
async function cleanResponse({ path, data }, options) {
    // Cleans up an api response
    switch (path) {
        case 'player': return await player_1.cleanPlayerResponse(data.player);
        case 'skyblock/profile': return await profile_1.cleanSkyblockProfileResponse(data.profile, options);
        case 'skyblock/profiles': return await profiles_1.cleanSkyblockProfilesResponse(data.profiles);
    }
}
/**
 * Higher level function that requests the api for a user, and returns the cleaned response
 * This is safe to fetch many times because the results are cached!
 * @param included lets you choose what is returned, so there's less processing required on the backend
 * used inclusions: player, profiles
 */
async function fetchUser({ user, uuid, username }, included = ['player'], customization) {
    if (!uuid) {
        // If the uuid isn't provided, get it
        uuid = await cached.uuidFromUser(user || username);
    }
    const websiteAccountPromise = customization ? database_1.fetchAccount(uuid) : null;
    if (!uuid) {
        // the user doesn't exist.
        if (_1.debug)
            console.debug('error:', user, 'doesnt exist');
        return null;
    }
    const includePlayers = included.includes('player');
    const includeProfiles = included.includes('profiles');
    let profilesData;
    let basicProfilesData;
    let playerData;
    if (includePlayers) {
        playerData = await cached.fetchPlayer(uuid);
        // if not including profiles, include lightweight profiles just in case
        if (!includeProfiles)
            basicProfilesData = playerData === null || playerData === void 0 ? void 0 : playerData.profiles;
        if (playerData)
            delete playerData.profiles;
    }
    if (includeProfiles) {
        profilesData = await cached.fetchSkyblockProfiles(uuid);
    }
    let activeProfile = null;
    let lastOnline = 0;
    if (includeProfiles) {
        for (const profile of profilesData) {
            const member = profile.members.find(member => member.uuid === uuid);
            if (member.last_save > lastOnline) {
                lastOnline = member.last_save;
                activeProfile = profile;
            }
        }
    }
    let websiteAccount = undefined;
    if (websiteAccountPromise)
        websiteAccount = await websiteAccountPromise;
    return {
        player: playerData !== null && playerData !== void 0 ? playerData : null,
        profiles: profilesData !== null && profilesData !== void 0 ? profilesData : basicProfilesData,
        activeProfile: includeProfiles ? activeProfile === null || activeProfile === void 0 ? void 0 : activeProfile.uuid : undefined,
        online: includeProfiles ? lastOnline > (Date.now() - exports.saveInterval) : undefined,
        customization: websiteAccount === null || websiteAccount === void 0 ? void 0 : websiteAccount.customization
    };
}
exports.fetchUser = fetchUser;
/**
 * Fetch a CleanMemberProfile from a user and string
 * This is safe to use many times as the results are cached!
 * @param user A username or uuid
 * @param profile A profile name or profile uuid
 * @param customization Whether stuff like the user's custom background will be returned
 */
async function fetchMemberProfile(user, profile, customization) {
    const playerUuid = await cached.uuidFromUser(user);
    // we don't await the promise immediately so it can load while we do other stuff
    const websiteAccountPromise = customization ? database_1.fetchAccount(playerUuid) : null;
    const profileUuid = await cached.fetchProfileUuid(user, profile);
    // if the profile doesn't have an id, just return
    if (!profileUuid)
        return null;
    const player = await cached.fetchPlayer(playerUuid);
    const cleanProfile = await cached.fetchProfile(playerUuid, profileUuid);
    const member = cleanProfile.members.find(m => m.uuid === playerUuid);
    // remove unnecessary member data
    const simpleMembers = cleanProfile.members.map(m => {
        return {
            uuid: m.uuid,
            username: m.username,
            first_join: m.first_join,
            last_save: m.last_save,
            rank: m.rank
        };
    });
    cleanProfile.members = simpleMembers;
    let websiteAccount = undefined;
    if (websiteAccountPromise)
        websiteAccount = await websiteAccountPromise;
    return {
        member: {
            // the profile name is in member rather than profile since they sometimes differ for each member
            profileName: cleanProfile.name,
            // add all the member data
            ...member,
            // add all other data relating to the hypixel player, such as username, rank, etc
            ...player
        },
        profile: cleanProfile,
        customization: websiteAccount === null || websiteAccount === void 0 ? void 0 : websiteAccount.customization
    };
}
exports.fetchMemberProfile = fetchMemberProfile;
/**
 * Fetches the Hypixel API to get a CleanFullProfile. This doesn't do any caching and you should use hypixelCached.fetchProfile instead
 * @param playerUuid The UUID of the Minecraft player
 * @param profileUuid The UUID of the Hypixel SkyBlock profile
 */
async function fetchMemberProfileUncached(playerUuid, profileUuid) {
    const profile = await sendCleanApiRequest({
        path: 'skyblock/profile',
        args: { profile: profileUuid }
    }, null, { mainMemberUuid: playerUuid });
    // queue updating the leaderboard positions for the member, eventually
    for (const member of profile.members)
        database_1.queueUpdateDatabaseMember(member, profile);
    database_1.queueUpdateDatabaseProfile(profile);
    return profile;
}
exports.fetchMemberProfileUncached = fetchMemberProfileUncached;
/**
 * Fetches the Hypixel API to get a CleanProfile from its id. This doesn't do any caching and you should use hypixelCached.fetchBasicProfileFromUuid instead
 * @param playerUuid The UUID of the Minecraft player
 * @param profileUuid The UUID of the Hypixel SkyBlock profile
 */
async function fetchBasicProfileFromUuidUncached(profileUuid) {
    const profile = await sendCleanApiRequest({
        path: 'skyblock/profile',
        args: { profile: profileUuid }
    }, null, { basic: true });
    return profile;
}
exports.fetchBasicProfileFromUuidUncached = fetchBasicProfileFromUuidUncached;
async function fetchMemberProfilesUncached(playerUuid) {
    const profiles = await sendCleanApiRequest({
        path: 'skyblock/profiles',
        args: {
            uuid: playerUuid
        }
    }, null, {
        // only the inventories for the main player are generated, this is for optimization purposes
        mainMemberUuid: playerUuid
    });
    for (const profile of profiles) {
        for (const member of profile.members) {
            database_1.queueUpdateDatabaseMember(member, profile);
        }
        database_1.queueUpdateDatabaseProfile(profile);
    }
    return profiles;
}
exports.fetchMemberProfilesUncached = fetchMemberProfilesUncached;
