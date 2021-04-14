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
exports.fetchAllAuctions = exports.fetchProfileName = exports.fetchProfile = exports.fetchProfileUuid = exports.fetchSkyblockProfiles = exports.fetchBasicPlayer = exports.fetchPlayer = exports.usernameFromUser = exports.uuidFromUser = void 0;
const hypixel_1 = require("./hypixel");
const hypixel = __importStar(require("./hypixel"));
const util_1 = require("./util");
const mojang = __importStar(require("./mojang"));
const node_cache_1 = __importDefault(require("node-cache"));
const queue_promise_1 = __importDefault(require("queue-promise"));
const _1 = require(".");
// cache usernames for 4 hours
/** uuid: username */
const usernameCache = new node_cache_1.default({
    stdTTL: 60 * 60 * 4,
    checkperiod: 60,
    useClones: false,
});
const basicProfilesCache = new node_cache_1.default({
    stdTTL: 60 * 10,
    checkperiod: 60,
    useClones: true,
});
const playerCache = new node_cache_1.default({
    stdTTL: 60,
    checkperiod: 10,
    useClones: true,
});
// cache "basic players" (players without profiles) for 4 hours
const basicPlayerCache = new node_cache_1.default({
    stdTTL: 60 * 60 * 4,
    checkperiod: 60 * 10,
    useClones: true
});
const profileCache = new node_cache_1.default({
    stdTTL: 30,
    checkperiod: 10,
    useClones: true,
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
function waitForCacheSet(cache, key, value) {
    return new Promise((resolve, reject) => {
        const listener = (setKey, setValue) => {
            if (setKey === key || (value && setValue === value)) {
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
    if (usernameCache.has(util_1.undashUuid(user))) {
        // check if the uuid is a key
        const username = usernameCache.get(util_1.undashUuid(user));
        // sometimes the username will be null, return that
        if (username === null)
            return username;
        // if it has .then, then that means its a waitForCacheSet promise. This is done to prevent requests made while it is already requesting
        if (username.then) {
            const { key: uuid, value: _username } = await username;
            usernameCache.set(uuid, _username);
            return uuid;
        }
        else
            return util_1.undashUuid(user);
    }
    // check if the username is a value
    const uuidToUsername = usernameCache.mget(usernameCache.keys());
    for (const [uuid, username] of Object.entries(uuidToUsername)) {
        if (username && username.toLowerCase && user.toLowerCase() === username.toLowerCase())
            return uuid;
    }
    if (_1.debug)
        console.log('Cache miss: uuidFromUser', user);
    // set it as waitForCacheSet (a promise) in case uuidFromUser gets called while its fetching mojang
    usernameCache.set(util_1.undashUuid(user), waitForCacheSet(usernameCache, user, user));
    // not cached, actually fetch mojang api now
    let { uuid, username } = await mojang.profileFromUser(user);
    if (!uuid) {
        usernameCache.set(user, null);
        return;
    }
    // remove dashes from the uuid so its more normal
    uuid = util_1.undashUuid(uuid);
    if (user !== uuid)
        usernameCache.del(user);
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
        if (_1.debug)
            console.log('Cache hit! usernameFromUser', user);
        return usernameCache.get(util_1.undashUuid(user));
    }
    if (_1.debug)
        console.log('Cache miss: usernameFromUser', user);
    let { uuid, username } = await mojang.profileFromUser(user);
    uuid = util_1.undashUuid(uuid);
    usernameCache.set(uuid, username);
    return username;
}
exports.usernameFromUser = usernameFromUser;
async function fetchPlayer(user) {
    const playerUuid = await uuidFromUser(user);
    if (playerCache.has(playerUuid))
        return playerCache.get(playerUuid);
    const cleanPlayer = await hypixel.sendCleanApiRequest({
        path: 'player',
        args: { uuid: playerUuid }
    });
    if (!cleanPlayer)
        return;
    // clone in case it gets modified somehow later
    playerCache.set(playerUuid, cleanPlayer);
    usernameCache.set(playerUuid, cleanPlayer.username);
    const cleanBasicPlayer = Object.assign({}, cleanPlayer);
    delete cleanBasicPlayer.profiles;
    basicPlayerCache.set(playerUuid, cleanBasicPlayer);
    return cleanPlayer;
}
exports.fetchPlayer = fetchPlayer;
/** Fetch a player without their profiles. This is heavily cached. */
async function fetchBasicPlayer(user) {
    const playerUuid = await uuidFromUser(user);
    if (basicPlayerCache.has(playerUuid))
        return basicPlayerCache.get(playerUuid);
    const player = await fetchPlayer(playerUuid);
    delete player.profiles;
    return player;
}
exports.fetchBasicPlayer = fetchBasicPlayer;
async function fetchSkyblockProfiles(playerUuid) {
    if (profilesCache.has(playerUuid)) {
        if (_1.debug)
            console.log('Cache hit! fetchSkyblockProfiles', playerUuid);
        return profilesCache.get(playerUuid);
    }
    if (_1.debug)
        console.log('Cache miss: fetchSkyblockProfiles', playerUuid);
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
    profilesCache.set(playerUuid, basicProfiles);
    return basicProfiles;
}
exports.fetchSkyblockProfiles = fetchSkyblockProfiles;
/** Fetch an array of `BasicProfile`s */
async function fetchBasicProfiles(user) {
    const playerUuid = await uuidFromUser(user);
    if (!playerUuid)
        return; // invalid player, just return
    if (basicProfilesCache.has(playerUuid)) {
        if (_1.debug)
            console.log('Cache hit! fetchBasicProfiles', playerUuid);
        return basicProfilesCache.get(playerUuid);
    }
    if (_1.debug)
        console.log('Cache miss: fetchBasicProfiles', user);
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
    if (!profile) {
        if (_1.debug)
            console.log('no profile provided?', user, profile);
        return null;
    }
    if (_1.debug)
        console.log('Cache miss: fetchProfileUuid', user);
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
        // we have the profile cached, return it :)
        if (_1.debug)
            console.log('Cache hit! fetchProfile', profileUuid);
        return profileCache.get(profileUuid);
    }
    if (_1.debug)
        console.log('Cache miss: fetchProfile', user, profile);
    const profileName = await fetchProfileName(user, profile);
    const cleanProfile = await hypixel.fetchMemberProfileUncached(playerUuid, profileUuid);
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
        if (_1.debug)
            console.log('Cache hit! fetchProfileName', profileUuid);
        return profileNameCache.get(`${playerUuid}.${profileUuid}`);
    }
    if (_1.debug)
        console.log('Cache miss: fetchProfileName', user, profile);
    const basicProfiles = await fetchBasicProfiles(playerUuid);
    let profileName;
    for (const basicProfile of basicProfiles)
        if (basicProfile.uuid === playerUuid)
            profileName = basicProfile.name;
    profileNameCache.set(`${playerUuid}.${profileUuid}`, profileName);
    return profileName;
}
exports.fetchProfileName = fetchProfileName;
let allAuctionsCache = [];
let nextAuctionsUpdate = 0;
let nextAuctionsUpdateTimeout = null;
// we use a queue so it doesnt fetch twice at the same time, and instead it waits so it can just use the cached version
const fetchAllAuctionsQueue = new queue_promise_1.default({
    concurrent: 1
});
/**
 * Fetch an array of all active Auctions
 */
async function fetchAllAuctions() {
    if (Date.now() / 1000 > nextAuctionsUpdate) {
        fetchAllAuctionsQueue.enqueue(hypixel_1.fetchAllAuctionsUncached);
        const auctionsResponse = await fetchAllAuctionsQueue.dequeue();
        allAuctionsCache = auctionsResponse.auctions;
        // the auctions endpoint updates every 60 seconds
        nextAuctionsUpdate = auctionsResponse.lastUpdated + 60;
        // if there's already a timeout, clear it and make a new one
        if (nextAuctionsUpdateTimeout)
            clearTimeout(nextAuctionsUpdateTimeout);
        // make a timeout for the next auctions update
        nextAuctionsUpdateTimeout = setTimeout(fetchAllAuctions, Date.now() - nextAuctionsUpdate * 1000);
    }
    return allAuctionsCache;
}
exports.fetchAllAuctions = fetchAllAuctions;
