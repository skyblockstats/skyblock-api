"use strict";
/**
 * Fetch the clean and cached Hypixel API
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchProfileName = exports.fetchProfile = exports.fetchProfileUuid = exports.fetchSkyblockProfiles = exports.fetchPlayer = exports.usernameFromUser = exports.uuidFromUser = void 0;
const node_cache_1 = __importDefault(require("node-cache"));
const mojang = __importStar(require("./mojang"));
const hypixel = __importStar(require("./hypixel"));
const util_1 = require("./util");
// cache usernames for 4 hours
const usernameCache = new node_cache_1.default({
    stdTTL: 60 * 60 * 4,
    checkperiod: 60,
    useClones: false,
});
const basicProfilesCache = new node_cache_1.default({
    stdTTL: 60 * 10,
    checkperiod: 60,
    useClones: false,
});
const playerCache = new node_cache_1.default({
    stdTTL: 60,
    checkperiod: 10,
    useClones: false,
});
const profileCache = new node_cache_1.default({
    stdTTL: 30,
    checkperiod: 10,
    useClones: false,
});
const profilesCache = new node_cache_1.default({
    stdTTL: 60 * 3,
    checkperiod: 10,
    useClones: false,
});
const profileNameCache = new node_cache_1.default({
    stdTTL: 60 * 60,
    checkperiod: 60,
    useClones: false,
});
/**
 * Fetch the uuid from a user
 * @param user A user can be either a uuid or a username
 */
async function uuidFromUser(user) {
    if (usernameCache.has(util_1.undashUuid(user)))
        // check if the uuid is a key
        return util_1.undashUuid(user);
    // check if the username is a value
    const uuidToUsername = usernameCache.mget(usernameCache.keys());
    for (const [uuid, username] of Object.entries(uuidToUsername)) {
        if (user.toLowerCase() === username.toLowerCase())
            return uuid;
    }
    // not cached, actually fetch mojang api now
    let { uuid, username } = await mojang.mojangDataFromUser(user);
    // remove dashes from the uuid so its more normal
    uuid = util_1.undashUuid(uuid);
    usernameCache.set(uuid, username);
    return uuid;
}
exports.uuidFromUser = uuidFromUser;
/**
 * Fetch the username from a user
 * @param user A user can be either a uuid or a username
 */
async function usernameFromUser(user) {
    if (usernameCache.has(util_1.undashUuid(user))) {
        return usernameCache.get(util_1.undashUuid(user));
    }
    let { uuid, username } = await mojang.mojangDataFromUser(user);
    uuid = util_1.undashUuid(uuid);
    usernameCache.set(uuid, username);
    return username;
}
exports.usernameFromUser = usernameFromUser;
async function fetchPlayer(user) {
    const playerUuid = await uuidFromUser(user);
    if (playerCache.has(playerUuid)) {
        console.log('cache hit! fetchPlayer', playerUuid);
        return playerCache.get(playerUuid);
    }
    const cleanPlayer = await hypixel.sendCleanApiRequest({
        path: 'player',
        args: { uuid: playerUuid }
    });
    // clone in case it gets modified somehow later
    const cleanPlayerClone = Object.assign({}, cleanPlayer);
    playerCache.set(playerUuid, cleanPlayerClone);
    return cleanPlayer;
}
exports.fetchPlayer = fetchPlayer;
async function fetchSkyblockProfiles(playerUuid) {
    if (profilesCache.has(playerUuid)) {
        console.log('cache hit! fetchSkyblockProfiles', playerUuid);
        return profilesCache.get(playerUuid);
    }
    const profiles = await hypixel.sendCleanApiRequest({
        path: 'skyblock/profiles',
        args: {
            uuid: playerUuid
        }
    }, null, {
        // only the inventories for the main player are generated, this is for optimization purposes
        mainMemberUuid: playerUuid
    });
    const basicProfiles = [];
    // create the basicProfiles array
    for (const profile of profiles) {
        const basicProfile = {
            name: profile.name,
            uuid: profile.uuid,
            members: profile.members.map(m => {
                return {
                    uuid: m.uuid,
                    username: m.username,
                    first_join: m.first_join,
                    last_save: m.last_save,
                    rank: m.rank
                };
            })
        };
        basicProfiles.push(basicProfile);
    }
    // cache the profiles
    profilesCache.set(playerUuid, basicProfiles);
    return basicProfiles;
}
exports.fetchSkyblockProfiles = fetchSkyblockProfiles;
/** Fetch an array of `BasicProfile`s */
async function fetchBasicProfiles(user) {
    const playerUuid = await uuidFromUser(user);
    if (basicProfilesCache.has(playerUuid)) {
        console.log('cache hit! fetchBasicProfiles');
        return basicProfilesCache.get(playerUuid);
    }
    const player = await fetchPlayer(playerUuid);
    const profiles = player.profiles;
    basicProfilesCache.set(playerUuid, profiles);
    // cache the profile names and uuids to profileNameCache because we can
    for (const profile of profiles)
        profileNameCache.set(`${playerUuid}.${profile.uuid}`, profile.name);
    return profiles;
}
/**
 * Fetch a profile UUID from its name and user
 * @param user A username or uuid
 * @param profile A profile name or profile uuid
 */
async function fetchProfileUuid(user, profile) {
    // if a profile wasn't provided, return
    if (!profile)
        return null;
    const profiles = await fetchBasicProfiles(user);
    const profileUuid = util_1.undashUuid(profile);
    for (const p of profiles) {
        if (p.name.toLowerCase() === profileUuid.toLowerCase())
            return util_1.undashUuid(p.uuid);
        else if (util_1.undashUuid(p.uuid) === util_1.undashUuid(profileUuid))
            return util_1.undashUuid(p.uuid);
    }
}
exports.fetchProfileUuid = fetchProfileUuid;
/**
 * Fetch an entire profile from the user and profile data
 * @param user A username or uuid
 * @param profile A profile name or profile uuid
 */
async function fetchProfile(user, profile) {
    const playerUuid = await uuidFromUser(user);
    const profileUuid = await fetchProfileUuid(playerUuid, profile);
    if (profileCache.has(profileUuid)) {
        console.log('cache hit! fetchProfile');
        // we have the profile cached, return it :)
        return profileCache.get(profileUuid);
    }
    const profileName = await fetchProfileName(user, profile);
    const cleanProfile = await hypixel.sendCleanApiRequest({
        path: 'skyblock/profile',
        args: { profile: profileUuid }
    }, null, { mainMemberUuid: playerUuid });
    // we know the name from fetchProfileName, so set it here
    cleanProfile.name = profileName;
    profileCache.set(profileUuid, cleanProfile);
    return cleanProfile;
}
exports.fetchProfile = fetchProfile;
/**
 * Fetch the name of a profile from the user and profile uuid
 * @param user A player uuid or username
 * @param profile A profile uuid or name
 */
async function fetchProfileName(user, profile) {
    // we're fetching the profile and player uuid again in case we were given a name, but it's cached so it's not much of a problem
    const profileUuid = await fetchProfileUuid(user, profile);
    const playerUuid = await uuidFromUser(user);
    if (profileNameCache.has(`${playerUuid}.${profileUuid}`)) {
        // Return the profile name if it's cached
        console.log('cache hit! fetchProfileName');
        return profileNameCache.get(`${playerUuid}.${profileUuid}`);
    }
    const basicProfiles = await fetchBasicProfiles(playerUuid);
    let profileName;
    for (const basicProfile of basicProfiles)
        if (basicProfile.uuid === playerUuid)
            profileName = basicProfile.name;
    profileNameCache.set(`${playerUuid}.${profileUuid}`, profileName);
    return profileName;
}
exports.fetchProfileName = fetchProfileName;
