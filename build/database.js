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
exports.updateDatabaseMember = void 0;
const constants = __importStar(require("./constants"));
const mongodb_1 = require("mongodb");
const node_cache_1 = __importDefault(require("node-cache"));
// don't update the user for 3 minutes
const recentlyUpdated = new node_cache_1.default({
    stdTTL: 60 * 3,
    checkperiod: 60,
    useClones: false,
});
const cachedLeaderboards = new Map();
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
    // if you want to add a new leaderboard for member attributes, add it here
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
async function fetchMemberLeaderboard(name) {
    if (cachedLeaderboards.has(name))
        return cachedLeaderboards.get(name);
    // typescript forces us to make a new variable and set it this way because it gives an error otherwise
    const query = {};
    query[`stats.${name}`] = { '$exists': true };
    const sortQuery = {};
    sortQuery[`stats.${name}`] = 1;
    const leaderboard = await memberLeaderboardsCollection.find(query).sort(sortQuery).toArray();
    cachedLeaderboards.set(name, leaderboard);
    return leaderboard;
}
async function getLeaderboardRequirement(name) {
    const leaderboard = await fetchMemberLeaderboard(name);
    // if there's more than 100 items, return the 100th. if there's less, return null
    if (leaderboard.length > 100)
        return leaderboard[100].stats[name];
    else
        return null;
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
    const leaderboardAttributes = getMemberLeaderboardAttributes(member);
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
connect();
