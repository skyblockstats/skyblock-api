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
exports.fetchProfileName = exports.fetchBasicProfileFromUuid = exports.fetchProfile = exports.fetchProfileUuid = exports.fetchSkyblockProfiles = exports.fetchBasicPlayer = exports.fetchPlayer = exports.usernameFromUser = exports.uuidFromUser = exports.profileNameCache = exports.profilesCache = exports.profileCache = exports.basicPlayerCache = exports.playerCache = exports.basicProfilesCache = exports.usernameCache = void 0;
const node_cache_1 = __importDefault(require("node-cache"));
const lru_cache_1 = __importDefault(require("lru-cache"));
const mojang = __importStar(require("./mojang"));
const hypixel = __importStar(require("./hypixel"));
const util_1 = require("./util");
const _1 = require(".");
// cache usernames for 4 hours
/** uuid: username */
exports.usernameCache = new node_cache_1.default({
    stdTTL: 60 * 60 * 4,
    checkperiod: 60,
    useClones: false,
});
exports.usernameCache.setMaxListeners(20);
exports.basicProfilesCache = new node_cache_1.default({
    stdTTL: 60 * 10,
    checkperiod: 60,
    useClones: true,
});
exports.playerCache = new node_cache_1.default({
    stdTTL: 60,
    checkperiod: 10,
    useClones: true,
});
// cache "basic players" (players without profiles) for 4 hours
exports.basicPlayerCache = new lru_cache_1.default({
    max: 20000,
    maxAge: 60 * 60 * 4 * 1000,
});
exports.profileCache = new node_cache_1.default({
    stdTTL: 30,
    checkperiod: 10,
    useClones: true,
});
exports.profilesCache = new node_cache_1.default({
    stdTTL: 60 * 3,
    checkperiod: 10,
    useClones: false,
});
exports.profileNameCache = new node_cache_1.default({
    stdTTL: 60 * 60,
    checkperiod: 60,
    useClones: false,
});
function waitForCacheSet(cache, key, value) {
    return new Promise((resolve, reject) => {
        const listener = (setKey, setValue) => {
            if (((setKey === key) || (value && setValue === value)) && typeof setValue === 'string') {
                cache.removeListener('set', listener);
                return resolve({ key: setKey, value: setValue });
            }
        };
        cache.on('set', listener);
    });
}
/**
 * Fetch the uuid from a user
 * @param user A user can be either a uuid or a username
 */
async function uuidFromUser(user) {
    // if the user is 32 characters long, it has to be a uuid
    if (util_1.isUuid(user))
        return util_1.undashUuid(user);
    if (exports.usernameCache.has(util_1.undashUuid(user))) {
        // check if the uuid is a key
        const username = exports.usernameCache.get(util_1.undashUuid(user));
        // sometimes the username will be null, return that
        if (username === null)
            return null;
        // if it has .then, then that means its a waitForCacheSet promise. This is done to prevent requests made while it is already requesting
        if (username.then) {
            const { key: uuid, value: _username } = await username;
            exports.usernameCache.set(uuid, _username);
            return uuid;
        }
        else
            return util_1.undashUuid(user);
    }
    // check if the username is a value
    const uuidToUsername = exports.usernameCache.mget(exports.usernameCache.keys());
    for (const [uuid, username] of Object.entries(uuidToUsername)) {
        if (username && username.toLowerCase && user.toLowerCase() === username.toLowerCase())
            return uuid;
    }
    if (_1.debug)
        console.debug('Cache miss: uuidFromUser', user);
    const undashedUser = util_1.undashUuid(user);
    // set it as waitForCacheSet (a promise) in case uuidFromUser gets called while its fetching mojang
    exports.usernameCache.set(undashedUser, waitForCacheSet(exports.usernameCache, user, user));
    // not cached, actually fetch mojang api now
    let { uuid, username } = await mojang.profileFromUser(user);
    if (!uuid) {
        exports.usernameCache.set(user, null);
        return;
    }
    // remove dashes from the uuid so its more normal
    uuid = util_1.undashUuid(uuid);
    exports.usernameCache.del(undashedUser);
    exports.usernameCache.set(uuid, username);
    return uuid;
}
exports.uuidFromUser = uuidFromUser;
/**
 * Fetch the username from a user
 * @param user A user can be either a uuid or a username
 */
async function usernameFromUser(user) {
    if (exports.usernameCache.has(util_1.undashUuid(user))) {
        if (_1.debug)
            console.debug('Cache hit! usernameFromUser', user);
        return exports.usernameCache.get(util_1.undashUuid(user));
    }
    if (_1.debug)
        console.debug('Cache miss: usernameFromUser', user);
    let { uuid, username } = await mojang.profileFromUser(user);
    uuid = util_1.undashUuid(uuid);
    exports.usernameCache.set(uuid, username);
    return username;
}
exports.usernameFromUser = usernameFromUser;
let fetchingPlayers = new Set();
async function fetchPlayer(user) {
    const playerUuid = await uuidFromUser(user);
    if (exports.playerCache.has(playerUuid))
        return exports.playerCache.get(playerUuid);
    // if it's already in the process of fetching, check every 100ms until it's not fetching the player anymore and fetch it again, since it'll be cached now
    if (fetchingPlayers.has(playerUuid)) {
        while (fetchingPlayers.has(playerUuid)) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        return await fetchPlayer(user);
    }
    fetchingPlayers.add(playerUuid);
    const cleanPlayer = await hypixel.sendCleanApiRequest({
        path: 'player',
        args: { uuid: playerUuid }
    });
    fetchingPlayers.delete(playerUuid);
    if (!cleanPlayer)
        return;
    // clone in case it gets modified somehow later
    exports.playerCache.set(playerUuid, cleanPlayer);
    exports.usernameCache.set(playerUuid, cleanPlayer.username);
    const cleanBasicPlayer = Object.assign({}, cleanPlayer);
    delete cleanBasicPlayer.profiles;
    exports.basicPlayerCache.set(playerUuid, cleanBasicPlayer);
    return cleanPlayer;
}
exports.fetchPlayer = fetchPlayer;
/** Fetch a player without their profiles. This is heavily cached. */
async function fetchBasicPlayer(user) {
    const playerUuid = await uuidFromUser(user);
    if (exports.basicPlayerCache.has(playerUuid))
        return exports.basicPlayerCache.get(playerUuid);
    const player = await fetchPlayer(playerUuid);
    if (!player)
        console.debug('no player? this should never happen', user);
    delete player.profiles;
    return player;
}
exports.fetchBasicPlayer = fetchBasicPlayer;
async function fetchSkyblockProfiles(playerUuid) {
    if (exports.profilesCache.has(playerUuid)) {
        if (_1.debug)
            console.debug('Cache hit! fetchSkyblockProfiles', playerUuid);
        return exports.profilesCache.get(playerUuid);
    }
    if (_1.debug)
        console.debug('Cache miss: fetchSkyblockProfiles', playerUuid);
    const profiles = await hypixel.fetchMemberProfilesUncached(playerUuid);
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
    exports.profilesCache.set(playerUuid, basicProfiles);
    return basicProfiles;
}
exports.fetchSkyblockProfiles = fetchSkyblockProfiles;
/** Fetch an array of `BasicProfile`s */
async function fetchBasicProfiles(user) {
    const playerUuid = await uuidFromUser(user);
    if (!playerUuid)
        return; // invalid player, just return
    if (exports.basicProfilesCache.has(playerUuid)) {
        if (_1.debug)
            console.debug('Cache hit! fetchBasicProfiles', playerUuid);
        return exports.basicProfilesCache.get(playerUuid);
    }
    if (_1.debug)
        console.debug('Cache miss: fetchBasicProfiles', user);
    const player = await fetchPlayer(playerUuid);
    if (!player) {
        console.log('bruh playerUuid', user, playerUuid);
        return [];
    }
    const profiles = player.profiles;
    exports.basicProfilesCache.set(playerUuid, profiles);
    // cache the profile names and uuids to profileNameCache because we can
    for (const profile of profiles)
        exports.profileNameCache.set(`${playerUuid}.${profile.uuid}`, profile.name);
    return profiles;
}
/**
 * Fetch a profile UUID from its name and user
 * @param user A username or uuid
 * @param profile A profile name or profile uuid
 */
async function fetchProfileUuid(user, profile) {
    // if a profile wasn't provided, return
    if (!profile) {
        if (_1.debug)
            console.debug('no profile provided?', user, profile);
        return null;
    }
    if (_1.debug)
        console.debug('Cache miss: fetchProfileUuid', user, profile);
    const profiles = await fetchBasicProfiles(user);
    if (!profiles)
        return; // user probably doesnt exist
    const profileUuid = util_1.undashUuid(profile);
    for (const p of profiles) {
        if (p.name.toLowerCase() === profileUuid.toLowerCase())
            return util_1.undashUuid(p.uuid);
        else if (util_1.undashUuid(p.uuid) === util_1.undashUuid(profileUuid))
            return util_1.undashUuid(p.uuid);
    }
    return null;
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
    if (!profileUuid)
        return null;
    if (exports.profileCache.has(profileUuid)) {
        // we have the profile cached, return it :)
        if (_1.debug)
            console.debug('Cache hit! fetchProfile', profileUuid);
        return exports.profileCache.get(profileUuid);
    }
    if (_1.debug)
        console.debug('Cache miss: fetchProfile', user, profile);
    const profileName = await fetchProfileName(user, profile);
    const cleanProfile = await hypixel.fetchMemberProfileUncached(playerUuid, profileUuid);
    // we know the name from fetchProfileName, so set it here
    cleanProfile.name = profileName;
    exports.profileCache.set(profileUuid, cleanProfile);
    return cleanProfile;
}
exports.fetchProfile = fetchProfile;
/**
 * Fetch a CleanProfile from the uuid
 * @param profileUuid A profile name or profile uuid
*/
async function fetchBasicProfileFromUuid(profileUuid) {
    if (exports.profileCache.has(profileUuid)) {
        // we have the profile cached, return it :)
        if (_1.debug)
            console.debug('Cache hit! fetchBasicProfileFromUuid', profileUuid);
        const profile = exports.profileCache.get(profileUuid);
        return {
            uuid: profile.uuid,
            members: profile.members.map(m => ({
                uuid: m.uuid,
                username: m.username,
                last_save: m.last_save,
                first_join: m.first_join,
                rank: m.rank,
            })),
            name: profile.name
        };
    }
    // TODO: cache this
    return await hypixel.fetchBasicProfileFromUuidUncached(profileUuid);
}
exports.fetchBasicProfileFromUuid = fetchBasicProfileFromUuid;
/**
 * Fetch the name of a profile from the user and profile uuid
 * @param user A player uuid or username
 * @param profile A profile uuid or name
 */
async function fetchProfileName(user, profile) {
    // we're fetching the profile and player uuid again in case we were given a name, but it's cached so it's not much of a problem
    const profileUuid = await fetchProfileUuid(user, profile);
    if (!profileUuid)
        return null;
    const playerUuid = await uuidFromUser(user);
    if (exports.profileNameCache.has(`${playerUuid}.${profileUuid}`)) {
        // Return the profile name if it's cached
        if (_1.debug)
            console.debug('Cache hit! fetchProfileName', profileUuid);
        return exports.profileNameCache.get(`${playerUuid}.${profileUuid}`);
    }
    if (_1.debug)
        console.debug('Cache miss: fetchProfileName', user, profile);
    const basicProfiles = await fetchBasicProfiles(playerUuid);
    let profileName;
    for (const basicProfile of basicProfiles)
        if (basicProfile.uuid === playerUuid)
            profileName = basicProfile.name;
    exports.profileNameCache.set(`${playerUuid}.${profileUuid}`, profileName);
    return profileName;
}
exports.fetchProfileName = fetchProfileName;
