"use strict";
/**
 * Store data about members for leaderboards
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
exports.updateDatabaseMember = exports.fetchMemberLeaderboard = void 0;
const constants = __importStar(require("./constants"));
const cached = __importStar(require("./hypixelCached"));
const mongodb_1 = require("mongodb");
const node_cache_1 = __importDefault(require("node-cache"));
const util_1 = require("./util");
// don't update the user for 3 minutes
const recentlyUpdated = new node_cache_1.default({
    stdTTL: 60 * 3,
    checkperiod: 60,
    useClones: false,
});
const cachedLeaderboards = new Map();
const leaderboardMax = 100;
let client;
let database;
let memberLeaderboardsCollection;
async function connect() {
    if (!process.env.db_uri)
        return console.warn('Warning: db_uri was not found in .env. Features that utilize the database such as leaderboards won\'t work.');
    if (!process.env.db_name)
        return console.warn('Warning: db_name was not found in .env. Features that utilize the database such as leaderboards won\'t work.');
    client = await mongodb_1.MongoClient.connect(process.env.db_uri, { useNewUrlParser: true, useUnifiedTopology: true });
    database = client.db(process.env.db_name);
    memberLeaderboardsCollection = database.collection('member-leaderboards');
}
function getMemberCollectionAttributes(member) {
    const collectionAttributes = {};
    for (const collection of member.collections) {
        const collectionLeaderboardName = `collection_${collection.name}`;
        collectionAttributes[collectionLeaderboardName] = collection.xp;
    }
    return collectionAttributes;
}
function getMemberLeaderboardAttributes(member) {
    // if you want to add a new leaderboard for member attributes, add it here (and getAllLeaderboardAttributes)
    return {
        // we use the raw stat names rather than the clean stats in case hypixel adds a new stat and it takes a while for us to clean it
        ...member.rawHypixelStats,
        // collection leaderboards
        ...getMemberCollectionAttributes(member),
        fairy_souls: member.fairy_souls.total,
        first_join: member.first_join,
        purse: member.purse,
        visited_zones: member.visited_zones.length,
    };
}
/** Fetch the names of all the leaderboards */
async function fetchAllMemberLeaderboardAttributes() {
    return [
        // we use the raw stat names rather than the clean stats in case hypixel adds a new stat and it takes a while for us to clean it
        ...await constants.fetchStats(),
        // collection leaderboards
        ...(await constants.fetchCollections()).map(value => `collection_${value}`),
        'fairy_souls',
        'first_join',
        'purse',
        'visited_zones',
    ];
}
async function fetchMemberLeaderboard(name) {
    if (cachedLeaderboards.has(name))
        return cachedLeaderboards.get(name);
    // typescript forces us to make a new variable and set it this way because it gives an error otherwise
    const query = {};
    query[`stats.${name}`] = { '$exists': true };
    const sortQuery = {};
    sortQuery[`stats.${name}`] = -1;
    const leaderboardRaw = await memberLeaderboardsCollection.find(query).sort(sortQuery).limit(leaderboardMax).toArray();
    const fetchLeaderboardPlayer = async (item) => {
        return {
            player: await cached.fetchPlayer(item.uuid),
            value: item.stats[name]
        };
    };
    const promises = [];
    for (const item of leaderboardRaw) {
        promises.push(fetchLeaderboardPlayer(item));
    }
    const leaderboard = await Promise.all(promises);
    cachedLeaderboards.set(name, leaderboard);
    return leaderboard;
}
exports.fetchMemberLeaderboard = fetchMemberLeaderboard;
async function getMemberLeaderboardRequirement(name) {
    const leaderboard = await fetchMemberLeaderboard(name);
    // if there's more than 100 items, return the 100th. if there's less, return null
    if (leaderboard.length >= leaderboardMax)
        return leaderboard[leaderboardMax - 1].value;
    else
        return null;
}
/** Get the attributes for the member, but only ones that would put them on the top 100 for leaderboards */
async function getApplicableAttributes(member) {
    const leaderboardAttributes = getMemberLeaderboardAttributes(member);
    const applicableAttributes = [];
    for (const [attributeName, attributeValue] of Object.entries(leaderboardAttributes)) {
        const requirement = await getMemberLeaderboardRequirement(attributeName);
        if (!requirement || attributeValue > requirement)
            applicableAttributes[attributeName] = attributeValue;
    }
}
/** Update the member's leaderboard data on the server if applicable */
async function updateDatabaseMember(member) {
    if (!client)
        return; // the db client hasn't been initialized
    // the member's been updated too recently, just return
    if (recentlyUpdated.get(member.uuid))
        return;
    // store the member in recentlyUpdated so it cant update for 3 more minutes
    recentlyUpdated.set(member.uuid, true);
    await constants.addStats(Object.keys(member.rawHypixelStats));
    await constants.addCollections(member.collections.map(value => value.name));
    const leaderboardAttributes = await getApplicableAttributes(member);
    await memberLeaderboardsCollection.updateOne({
        uuid: member.uuid
    }, {
        '$set': {
            'stats': leaderboardAttributes,
            'last_updated': new Date()
        }
    }, {
        upsert: true
    });
}
exports.updateDatabaseMember = updateDatabaseMember;
/**
 * Remove leaderboard attributes for members that wouldn't actually be on the leaderboard. This saves a lot of storage space
 */
async function removeBadMemberLeaderboardAttributes() {
    const leaderboards = await fetchAllMemberLeaderboardAttributes();
    // shuffle so if the application is restarting many times itll still be useful
    for (const leaderboard of util_1.shuffle(leaderboards)) {
        // wait 10 seconds so it doesnt use as much ram
        await new Promise(resolve => setTimeout(resolve, 10000));
        const unsetValue = {};
        unsetValue[leaderboard] = '';
        const filter = {};
        const requirement = await getMemberLeaderboardRequirement(leaderboard);
        if (requirement !== null) {
            filter[`stats.${leaderboard}`] = {
                '$lt': requirement
            };
            await memberLeaderboardsCollection.updateMany(filter, { '$unset': unsetValue });
        }
    }
}
connect()
    .then(removeBadMemberLeaderboardAttributes);
