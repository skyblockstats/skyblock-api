/**
 * Store data about members for leaderboards
*/
import { replaceDifferencesWithQuestionMark, shuffle, sleep } from './util.js';
import { categorizeStat, getStatUnit } from './cleaners/skyblock/stats.js';
import { slayerLevels } from './cleaners/skyblock/slayers.js';
import { MongoClient } from 'mongodb';
import { getItemLowestBin } from './hypixel.js';
import * as cached from './hypixelCached.js';
import * as constants from './constants.js';
import NodeCache from 'node-cache';
import { v4 as uuid4 } from 'uuid';
import { debug } from './index.js';
import Queue from 'queue-promise';
// don't update the user for 3 minutes
const recentlyUpdated = new NodeCache({
    stdTTL: 60 * 3,
    checkperiod: 60,
    useClones: false,
});
// don't add stuff to the queue within the same 5 minutes
const recentlyQueued = new NodeCache({
    stdTTL: 60 * 5,
    checkperiod: 60,
    useClones: false,
});
export const cachedRawLeaderboards = new Map();
const leaderboardMax = 100;
const reversedLeaderboards = [
    'first_join',
    '_best_time', '_best_time_2'
];
let client = undefined;
let database;
let memberLeaderboardsCollection;
let profileLeaderboardsCollection;
let sessionsCollection;
let accountsCollection;
let itemsCollection;
let auctionsCollection;
if (!process.env.db_uri)
    console.warn('Warning: db_uri was not found in .env. Features that utilize the database such as leaderboards won\'t work');
else if (!process.env.db_name)
    console.warn('Warning: db_name was not found in .env. Features that utilize the database such as leaderboards won\'t work.');
else {
    client = new MongoClient(process.env.db_uri);
    database = client.db(process.env.db_name);
    memberLeaderboardsCollection = database.collection('member-leaderboards');
    profileLeaderboardsCollection = database.collection('profile-leaderboards');
    sessionsCollection = database.collection('sessions');
    accountsCollection = database.collection('accounts');
    itemsCollection = database.collection('items');
    auctionsCollection = database.collection('auctions');
}
const leaderboardInfos = {
    highest_crit_damage: 'This leaderboard is capped at the integer limit because Hypixel, look at the <a href="/leaderboard/highest_critical_damage">highest critical damage leaderboard</a> instead.',
    highest_critical_damage: 'uhhhhh yeah idk either',
    leaderboards_count: 'This leaderboard counts how many leaderboards players are in the top 100 for.',
    top_1_leaderboards_count: 'This leaderboard counts how many leaderboards players are #1 for.',
};
function getMemberCollectionAttributes(member) {
    const collectionAttributes = {};
    for (const collection of member.collections) {
        const collectionLeaderboardName = `collection_${collection.name}`;
        collectionAttributes[collectionLeaderboardName] = collection.xp;
    }
    return collectionAttributes;
}
function getMemberSkillAttributes(member) {
    const skillAttributes = {};
    for (const collection of member.skills) {
        const skillLeaderboardName = `skill_${collection.name}`;
        skillAttributes[skillLeaderboardName] = collection.xp;
    }
    return skillAttributes;
}
function getMemberSlayerAttributes(member) {
    const slayerAttributes = {
        slayer_total_xp: member.slayers.xp,
        slayer_total_kills: member.slayers.kills,
    };
    for (const slayer of member.slayers.bosses) {
        slayerAttributes[`slayer_${slayer.raw_name}_total_xp`] = slayer.xp;
        slayerAttributes[`slayer_${slayer.raw_name}_total_kills`] = slayer.kills;
        for (const tier of slayer.tiers) {
            slayerAttributes[`slayer_${slayer.raw_name}_${tier.tier}_kills`] = tier.kills;
        }
    }
    return slayerAttributes;
}
function getMemberLeaderboardAttributes(member) {
    // if you want to add a new leaderboard for member attributes, add it here (and getAllLeaderboardAttributes)
    return {
        // we use the raw stat names rather than the clean stats in case hypixel adds a new stat and it takes a while for us to clean it
        ...member.rawHypixelStats,
        // collection leaderboards
        ...getMemberCollectionAttributes(member),
        // skill leaderboards
        ...getMemberSkillAttributes(member),
        // slayer leaderboards
        ...getMemberSlayerAttributes(member),
        fairy_souls: member.fairy_souls.total,
        first_join: member.first_join,
        purse: member.purse,
        visited_zones: member.visited_zones.length,
    };
}
function getProfileLeaderboardAttributes(profile) {
    // if you want to add a new leaderboard for member attributes, add it here (and getAllLeaderboardAttributes)
    return {
        unique_minions: profile.minion_count
    };
}
export async function fetchAllLeaderboardsCategorized() {
    const memberLeaderboardAttributes = await fetchAllMemberLeaderboardAttributes();
    const profileLeaderboardAttributes = await fetchAllProfileLeaderboardAttributes();
    const categorizedLeaderboards = {};
    for (const leaderboard of [...memberLeaderboardAttributes, ...profileLeaderboardAttributes]) {
        const { category } = categorizeStat(leaderboard);
        if (category) {
            if (!categorizedLeaderboards[category])
                categorizedLeaderboards[category] = [];
            categorizedLeaderboards[category].push(leaderboard);
        }
    }
    // move misc to end by removing and readding it
    const misc = categorizedLeaderboards.misc;
    delete categorizedLeaderboards.misc;
    categorizedLeaderboards.misc = misc;
    return categorizedLeaderboards;
}
/** Fetch the raw names for the slayer leaderboards */
export async function fetchSlayerLeaderboards() {
    const rawSlayerNames = await constants.fetchSlayers();
    let leaderboardNames = [
        'slayer_total_xp',
        'slayer_total_kills'
    ];
    // we use the raw names (zombie, spider, wolf) instead of the clean names (revenant, tarantula, sven) because the raw names are guaranteed to never change
    for (const slayerNameRaw of rawSlayerNames) {
        leaderboardNames.push(`slayer_${slayerNameRaw}_total_xp`);
        leaderboardNames.push(`slayer_${slayerNameRaw}_total_kills`);
        for (let slayerTier = 1; slayerTier <= slayerLevels; slayerTier++) {
            leaderboardNames.push(`slayer_${slayerNameRaw}_${slayerTier}_kills`);
        }
    }
    return leaderboardNames;
}
/** Fetch the names of all the leaderboards that rank members */
export async function fetchAllMemberLeaderboardAttributes() {
    return [
        // we use the raw stat names rather than the clean stats in case hypixel adds a new stat and it takes a while for us to clean it
        ...await constants.fetchStats(),
        // collection leaderboards
        ...(await constants.fetchCollections()).map(value => `collection_${value}`),
        // skill leaderboards
        ...(await constants.fetchSkills()).map(value => `skill_${value}`),
        // slayer leaderboards
        ...await fetchSlayerLeaderboards(),
        'fairy_souls',
        'first_join',
        'purse',
        'visited_zones',
        'leaderboards_count',
        'top_1_leaderboards_count'
    ];
}
/** Fetch the names of all the leaderboards that rank profiles */
async function fetchAllProfileLeaderboardAttributes() {
    return [
        'unique_minions'
    ];
}
function isLeaderboardReversed(name) {
    for (const leaderboardMatch of reversedLeaderboards) {
        let trailingEnd = leaderboardMatch[0] === '_';
        let trailingStart = leaderboardMatch.substr(-1) === '_';
        if ((trailingStart && name.startsWith(leaderboardMatch))
            || (trailingEnd && name.endsWith(leaderboardMatch))
            || (name == leaderboardMatch))
            return true;
    }
    return false;
}
/** A set of names of the raw leaderboards that are currently being fetched. This is used to make sure two leaderboads aren't fetched at the same time */
const fetchingRawLeaderboardNames = new Set();
async function fetchMemberLeaderboardRaw(name) {
    if (!client)
        throw Error('Client isn\'t initialized yet');
    if (cachedRawLeaderboards.has(name))
        return cachedRawLeaderboards.get(name);
    // if it's currently being fetched, check every 100ms until it's in cachedRawLeaderboards
    if (fetchingRawLeaderboardNames.has(name)) {
        while (true) {
            await sleep(100);
            if (cachedRawLeaderboards.has(name))
                return cachedRawLeaderboards.get(name);
        }
    }
    // typescript forces us to make a new variable and set it this way because it gives an error otherwise
    const query = {};
    query[`stats.${name}`] = { '$exists': true, '$ne': NaN };
    const sortQuery = {};
    sortQuery[`stats.${name}`] = isLeaderboardReversed(name) ? 1 : -1;
    fetchingRawLeaderboardNames.add(name);
    const leaderboardRaw = (await memberLeaderboardsCollection
        .find(query)
        .sort(sortQuery)
        .limit(leaderboardMax)
        .toArray())
        .map((i) => {
        return {
            profile: i.profile,
            uuid: i.uuid,
            value: i.stats[name]
        };
    });
    fetchingRawLeaderboardNames.delete(name);
    cachedRawLeaderboards.set(name, leaderboardRaw);
    return leaderboardRaw;
}
async function fetchProfileLeaderboardRaw(name) {
    if (cachedRawLeaderboards.has(name))
        return cachedRawLeaderboards.get(name);
    // if it's currently being fetched, check every 100ms until it's in cachedRawLeaderboards
    if (fetchingRawLeaderboardNames.has(name)) {
        while (true) {
            await sleep(100);
            if (cachedRawLeaderboards.has(name))
                return cachedRawLeaderboards.get(name);
        }
    }
    // typescript forces us to make a new variable and set it this way because it gives an error otherwise
    const query = {};
    query[`stats.${name}`] = { '$exists': true, '$ne': NaN };
    const sortQuery = {};
    sortQuery[`stats.${name}`] = isLeaderboardReversed(name) ? 1 : -1;
    fetchingRawLeaderboardNames.add(name);
    const leaderboardRaw = (await profileLeaderboardsCollection
        .find(query)
        .sort(sortQuery)
        .limit(leaderboardMax)
        .toArray())
        .map((i) => {
        return {
            players: i.players,
            uuid: i.uuid,
            value: i.stats[name]
        };
    });
    fetchingRawLeaderboardNames.delete(name);
    cachedRawLeaderboards.set(name, leaderboardRaw);
    return leaderboardRaw;
}
/** Fetch a leaderboard that ranks members, as opposed to profiles */
export async function fetchMemberLeaderboard(name) {
    const leaderboardRaw = await fetchMemberLeaderboardRaw(name);
    const fetchLeaderboardPlayer = async (i) => {
        const player = await cached.fetchBasicPlayer(i.uuid);
        return {
            player,
            profileUuid: i.profile,
            value: i.value
        };
    };
    const promises = [];
    for (const item of leaderboardRaw) {
        promises.push(fetchLeaderboardPlayer(item));
    }
    const leaderboard = await Promise.all(promises);
    return {
        name: name,
        unit: getStatUnit(name) ?? null,
        list: leaderboard
    };
}
/** Fetch a leaderboard that ranks profiles, as opposed to members */
export async function fetchProfileLeaderboard(name) {
    const leaderboardRaw = await fetchProfileLeaderboardRaw(name);
    const fetchLeaderboardProfile = async (i) => {
        const players = [];
        for (const playerUuid of i.players) {
            const player = await cached.fetchBasicPlayer(playerUuid);
            if (player)
                players.push(player);
        }
        return {
            players: players,
            profileUuid: i.uuid,
            value: i.value
        };
    };
    const promises = [];
    for (const item of leaderboardRaw) {
        promises.push(fetchLeaderboardProfile(item));
    }
    const leaderboard = await Promise.all(promises);
    return {
        name: name,
        unit: getStatUnit(name) ?? null,
        list: leaderboard
    };
}
/** Fetch a leaderboard */
export async function fetchLeaderboard(name) {
    const profileLeaderboards = await fetchAllProfileLeaderboardAttributes();
    let leaderboard;
    if (profileLeaderboards.includes(name)) {
        leaderboard = await fetchProfileLeaderboard(name);
    }
    else {
        leaderboard = await fetchMemberLeaderboard(name);
    }
    if (leaderboardInfos[name])
        leaderboard.info = leaderboardInfos[name];
    return leaderboard;
}
/** Get the leaderboard positions a member is on. This may take a while depending on whether stuff is cached */
export async function fetchMemberLeaderboardSpots(player, profile) {
    const fullProfile = await cached.fetchProfile(player, profile);
    if (!fullProfile)
        return null;
    const fullMember = fullProfile.members.find(m => m.username.toLowerCase() === player.toLowerCase() || m.uuid === player);
    if (!fullMember)
        return null;
    // update the leaderboard positions for the member
    await updateDatabaseMember(fullMember, fullProfile);
    const applicableAttributes = await getApplicableMemberLeaderboardAttributes(fullMember);
    const memberLeaderboardSpots = [];
    for (const leaderboardName in applicableAttributes) {
        const leaderboard = await fetchMemberLeaderboardRaw(leaderboardName);
        const leaderboardPositionIndex = leaderboard.findIndex(i => i.uuid === fullMember.uuid && i.profile === fullProfile.uuid);
        memberLeaderboardSpots.push({
            name: leaderboardName,
            positionIndex: leaderboardPositionIndex,
            value: applicableAttributes[leaderboardName],
            unit: getStatUnit(leaderboardName) ?? null
        });
    }
    return memberLeaderboardSpots;
}
async function getLeaderboardRequirement(name, leaderboardType) {
    let leaderboard;
    if (leaderboardType === 'member')
        leaderboard = await fetchMemberLeaderboardRaw(name);
    else if (leaderboardType === 'profile')
        leaderboard = await fetchProfileLeaderboardRaw(name);
    // if there's more than 100 items, return the 100th. if there's less, return null
    return {
        top_100: leaderboard[leaderboardMax - 1]?.value ?? null,
        top_1: leaderboard[1]?.value ?? null
    };
}
/** Get the attributes for the member, but only ones that would put them on the top 100 for leaderboards */
async function getApplicableMemberLeaderboardAttributes(member) {
    const leaderboardAttributes = getMemberLeaderboardAttributes(member);
    const applicableAttributes = {};
    const applicableTop1Attributes = {};
    for (const [leaderboard, attributeValue] of Object.entries(leaderboardAttributes)) {
        const requirement = await getLeaderboardRequirement(leaderboard, 'member');
        const leaderboardReversed = isLeaderboardReversed(leaderboard);
        if ((requirement.top_100 === null)
            || (leaderboardReversed ? attributeValue < requirement.top_100 : attributeValue > requirement.top_100)) {
            applicableAttributes[leaderboard] = attributeValue;
        }
        if ((requirement.top_1 === null)
            || (leaderboardReversed ? attributeValue < requirement.top_1 : attributeValue > requirement.top_1)) {
            applicableTop1Attributes[leaderboard] = attributeValue;
        }
    }
    // add the "leaderboards count" attribute
    const leaderboardsCount = Object.keys(applicableAttributes).length;
    const leaderboardsCountRequirement = await getLeaderboardRequirement('leaderboards_count', 'member');
    if (leaderboardsCount > 0
        && ((leaderboardsCountRequirement.top_100 === null)
            || (leaderboardsCount > leaderboardsCountRequirement.top_100)))
        applicableAttributes['leaderboards_count'] = leaderboardsCount;
    // add the "first leaderboards count" attribute
    const top1LeaderboardsCount = Object.keys(applicableTop1Attributes).length;
    const top1LeaderboardsCountRequirement = await getLeaderboardRequirement('top_1_leaderboards_count', 'member');
    if (top1LeaderboardsCount > 0
        && ((top1LeaderboardsCountRequirement.top_100 === null)
            || (top1LeaderboardsCount > top1LeaderboardsCountRequirement.top_100)))
        applicableAttributes['top_1_leaderboards_count'] = top1LeaderboardsCount;
    return applicableAttributes;
}
/** Get the attributes for the profile, but only ones that would put them on the top 100 for leaderboards */
async function getApplicableProfileLeaderboardAttributes(profile) {
    const leaderboardAttributes = getProfileLeaderboardAttributes(profile);
    const applicableAttributes = {};
    const applicableTop1Attributes = {};
    for (const [leaderboard, attributeValue] of Object.entries(leaderboardAttributes)) {
        const requirement = await getLeaderboardRequirement(leaderboard, 'profile');
        const leaderboardReversed = isLeaderboardReversed(leaderboard);
        if ((requirement.top_100 === null)
            || (leaderboardReversed ? attributeValue < requirement.top_100 : attributeValue > requirement.top_100
                && attributeValue !== 0)) {
            applicableAttributes[leaderboard] = attributeValue;
        }
        if ((requirement.top_1 === null)
            || (leaderboardReversed ? attributeValue < requirement.top_1 : attributeValue > requirement.top_1
                && attributeValue !== 0)) {
            applicableTop1Attributes[leaderboard] = attributeValue;
        }
    }
    return applicableAttributes;
}
/** Update the member's leaderboard data on the server if applicable */
export async function updateDatabaseMember(member, profile) {
    if (!client)
        return; // the db client hasn't been initialized
    if (debug)
        console.debug('updateDatabaseMember', member.username);
    // the member's been updated too recently, just return
    if (recentlyUpdated.get(profile.uuid + member.uuid))
        return;
    // store the member in recentlyUpdated so it cant update for 3 more minutes
    recentlyUpdated.set(profile.uuid + member.uuid, true);
    if (debug)
        console.debug('adding member to leaderboards', member.username);
    if (member.rawHypixelStats)
        await constants.addStats(Object.keys(member.rawHypixelStats));
    await constants.addCollections(member.collections.map(coll => coll.name));
    await constants.addSkills(member.skills.map(skill => skill.name));
    await constants.addZones(member.visited_zones.map(zone => zone.name));
    await constants.addSlayers(member.slayers.bosses.map(s => s.raw_name));
    if (debug)
        console.debug('done constants..');
    const leaderboardAttributes = await getApplicableMemberLeaderboardAttributes(member);
    if (debug)
        console.debug('done getApplicableMemberLeaderboardAttributes..', leaderboardAttributes, member.username, profile.name);
    await memberLeaderboardsCollection.updateOne({
        uuid: member.uuid,
        profile: profile.uuid
    }, {
        $set: {
            stats: leaderboardAttributes,
            last_updated: new Date()
        }
    }, { upsert: true });
    for (const [attributeName, attributeValue] of Object.entries(leaderboardAttributes)) {
        const existingRawLeaderboard = await fetchMemberLeaderboardRaw(attributeName);
        const leaderboardReverse = isLeaderboardReversed(attributeName);
        const newRawLeaderboard = existingRawLeaderboard
            // remove the player from the leaderboard, if they're there
            .filter(value => value.uuid !== member.uuid || value.profile !== profile.uuid)
            .concat([{
                value: attributeValue,
                uuid: member.uuid,
                profile: profile.uuid
            }])
            .sort((a, b) => leaderboardReverse ? a.value - b.value : b.value - a.value)
            .slice(0, 100);
        cachedRawLeaderboards.set(attributeName, newRawLeaderboard);
    }
    if (debug)
        console.debug('added member to leaderboards', member.username, leaderboardAttributes);
}
/**
 * Update the profiles's leaderboard data on the server if applicable.
 * This will not also update the members, you have to call updateDatabaseMember separately for that
 */
export async function updateDatabaseProfile(profile) {
    if (!client)
        return; // the db client hasn't been initialized
    if (debug)
        console.debug('updateDatabaseProfile', profile.name);
    // the profile's been updated too recently, just return
    if (recentlyUpdated.get(profile.uuid + 'profile'))
        return;
    // store the profile in recentlyUpdated so it cant update for 3 more minutes
    recentlyUpdated.set(profile.uuid + 'profile', true);
    if (debug)
        console.debug('adding profile to leaderboards', profile.name);
    const leaderboardAttributes = await getApplicableProfileLeaderboardAttributes(profile);
    if (debug)
        console.debug('done getApplicableProfileLeaderboardAttributes..', leaderboardAttributes, profile.name);
    await profileLeaderboardsCollection.updateOne({
        uuid: profile.uuid
    }, {
        $set: {
            players: profile.members.map(p => p.uuid),
            stats: leaderboardAttributes,
            last_updated: new Date()
        }
    }, { upsert: true });
    // add the profile to the cached leaderboard without having to refetch it
    for (const [attributeName, attributeValue] of Object.entries(leaderboardAttributes)) {
        const existingRawLeaderboard = await fetchProfileLeaderboardRaw(attributeName);
        const leaderboardReverse = isLeaderboardReversed(attributeName);
        const newRawLeaderboard = existingRawLeaderboard
            // remove the player from the leaderboard, if they're there
            .filter(value => value.uuid !== profile.uuid)
            .concat([{
                value: attributeValue,
                uuid: profile.uuid,
                players: profile.members.map(p => p.uuid)
            }])
            .sort((a, b) => leaderboardReverse ? a.value - b.value : b.value - a.value)
            .slice(0, 100);
        cachedRawLeaderboards.set(attributeName, newRawLeaderboard);
    }
    if (debug)
        console.debug('added profile to leaderboards', profile.name, leaderboardAttributes);
}
export const leaderboardUpdateMemberQueue = new Queue({
    concurrent: 1,
    interval: 50
});
export const leaderboardUpdateProfileQueue = new Queue({
    concurrent: 1,
    interval: 500
});
/** Queue an update for the member's leaderboard data on the server if applicable */
export function queueUpdateDatabaseMember(member, profile) {
    if (recentlyQueued.get(profile.uuid + member.uuid))
        return;
    else
        recentlyQueued.set(profile.uuid + member.uuid, true);
    leaderboardUpdateMemberQueue.enqueue(async () => await updateDatabaseMember(member, profile));
}
/** Queue an update for the profile's leaderboard data on the server if applicable */
export function queueUpdateDatabaseProfile(profile) {
    if (recentlyQueued.get(profile.uuid + 'profile'))
        return;
    else
        recentlyQueued.set(profile.uuid + 'profile', true);
    leaderboardUpdateProfileQueue.enqueue(async () => await updateDatabaseProfile(profile));
}
/**
 * Remove leaderboard attributes for members that wouldn't actually be on the leaderboard. This saves a lot of storage space
 */
async function removeBadMemberLeaderboardAttributes() {
    const leaderboards = await fetchAllMemberLeaderboardAttributes();
    // shuffle so if the application is restarting many times itll still be useful
    for (const leaderboard of shuffle(leaderboards)) {
        // wait 10 seconds so it doesnt use as much ram
        await sleep(10 * 1000);
        const unsetValue = {};
        unsetValue[leaderboard] = '';
        const filter = {};
        const requirement = await getLeaderboardRequirement(leaderboard, 'member');
        const leaderboardReversed = isLeaderboardReversed(leaderboard);
        if (requirement !== null) {
            filter[`stats.${leaderboard}`] = {
                '$lt': leaderboardReversed ? undefined : requirement,
                '$gt': leaderboardReversed ? requirement : undefined
            };
            await memberLeaderboardsCollection.updateMany(filter, { '$unset': unsetValue });
        }
    }
    await memberLeaderboardsCollection.deleteMany({ stats: {} });
    await profileLeaderboardsCollection.deleteMany({ stats: {} });
}
export let finishedCachingRawLeaderboards = false;
/** Fetch all the leaderboards, used for caching. Don't call this often! */
async function fetchAllLeaderboards(fast) {
    const leaderboards = await fetchAllMemberLeaderboardAttributes();
    if (debug)
        console.debug('Caching raw leaderboards!');
    for (const leaderboard of shuffle(leaderboards))
        await fetchMemberLeaderboardRaw(leaderboard);
    finishedCachingRawLeaderboards = true;
}
export async function createSession(refreshToken, userData) {
    const sessionId = uuid4();
    await sessionsCollection?.insertOne({
        _id: sessionId,
        refresh_token: refreshToken,
        discord_user: {
            id: userData.id,
            name: userData.username + '#' + userData.discriminator
        },
        lastUpdated: new Date()
    });
    return sessionId;
}
export async function fetchSession(sessionId) {
    return await sessionsCollection?.findOne({ _id: sessionId });
}
export async function fetchAccount(minecraftUuid) {
    return await accountsCollection?.findOne({ minecraftUuid });
}
export async function fetchAccountFromDiscord(discordId) {
    return await accountsCollection?.findOne({ discordId });
}
export async function updateAccount(discordId, schema) {
    await accountsCollection?.updateOne({
        discordId
    }, { $set: schema }, { upsert: true });
}
/** Get the unique uuid (generated by us) for the item, based on the SkyBlock id, pet type, and other info */
export async function getItemUniqueId(item, update, returnEntireItem) {
    const itemUniqueData = {
        i: item.id,
        v: item.vanillaId || undefined,
        pt: item.pet_type,
        t: item.tier ?? undefined,
        pot: item.potion_type,
        potd: item.potion_duration_level,
        pote: item.potion_effectiveness_level,
        potl: item.potion_level,
        e: item.id === 'ENCHANTED_BOOK' ? item.enchantments : undefined,
    };
    // Delete undefined stuff from itemUniqueData
    Object.keys(itemUniqueData).forEach(key => itemUniqueData[key] === undefined && delete itemUniqueData[key]);
    // existing item is the data that we have on the item in the database, it's null if it doesn't exist
    const existingItem = await itemsCollection.findOne(itemUniqueData);
    // we're not updating anything, so just return the id now
    if (!update)
        return returnEntireItem ? existingItem : existingItem?._id;
    const itemUniqueId = existingItem ? existingItem._id : uuid4().replace(/-/g, '');
    // if the item in the database doesn't have a reforge but this one does, don't bother updating anything and just return the id
    if (existingItem?.r === false && item.reforge !== undefined)
        return returnEntireItem ? existingItem : itemUniqueId;
    let itemName;
    let itemLore;
    // the item in the database has a reforge but this one doesn't, that means we can override all of the data (since reforges will mess with the lore)
    if (existingItem?.r && item.reforge === undefined) {
        itemName = item.display.name;
        itemLore = item.display.lore.join('\n');
    }
    else {
        itemName = existingItem ? replaceDifferencesWithQuestionMark(existingItem.dn, item.display.name) : item.display.name;
        itemLore = existingItem?.l ? replaceDifferencesWithQuestionMark(existingItem.l, item.display.lore.join('\n')) : item.display.lore.join('\n');
    }
    // all the stuff is the same, don't bother updating it
    if (existingItem
        && itemName === existingItem.dn
        && (!itemLore || itemLore === existingItem.l)
        && item.head_texture === existingItem.h
        && (item.reforge !== undefined) === existingItem.r)
        return returnEntireItem ? existingItem : itemUniqueId;
    let updateSet = {
        dn: itemName,
        h: item.head_texture,
        r: item.reforge !== undefined
    };
    if (itemLore)
        updateSet.l = itemLore;
    await itemsCollection.updateOne({
        _id: itemUniqueId,
        ...itemUniqueData
    }, {
        $set: updateSet
    }, { upsert: true });
    return returnEntireItem ? {
        ...updateSet,
        _id: itemUniqueId,
        ...itemUniqueData
    } : itemUniqueId;
}
export async function addAuction(auction) {
    if (auction.bin)
        return; // no bin auctions
    console.log('ok added auction', auction.uuid);
    const itemUniqueId = await getItemUniqueId(auction.item, true);
    try {
        await auctionsCollection.insertOne({
            _id: auction.uuid,
            i: itemUniqueId,
            p: auction.bidAmount / auction.item.count,
            r: auction.item.reforge,
            t: new Date(auction.end * 1000),
            e: auction.item.enchantments,
        });
    }
    catch {
        // failed inserting, probably duplicate key
    }
}
let previouslyEndedAuctionIds = [];
/** Run `addAuction` for whatever auctions ended, this should only be run once per minute. */
async function addEndedAuctions() {
    const endedAuctions = await cached.fetchAllEndedAuctions();
    const previouslyEndedAuctionIdsClone = previouslyEndedAuctionIds.slice();
    previouslyEndedAuctionIds = endedAuctions.map(a => a.uuid);
    console.log(endedAuctions.length, 'ended auctions');
    for (const auction of endedAuctions) {
        // if the auction isn't bin and it was actually bid on, add it to the database
        if (!previouslyEndedAuctionIdsClone.includes(auction.uuid) && !auction.bin && auction.bidAmount) {
            await addAuction(auction);
        }
    }
}
function schemaToItem(itemSchema, additionalData) {
    return {
        display: {
            name: itemSchema.dn,
            lore: itemSchema.l?.split('\n') ?? [],
            glint: itemSchema.e ? Object.keys(itemSchema.e).length > 0 : false,
        },
        id: itemSchema.i,
        vanillaId: itemSchema.v,
        enchantments: itemSchema.e,
        head_texture: itemSchema.h ?? undefined,
        reforge: additionalData?.reforge,
        tier: itemSchema.t,
    };
}
/**
 * Fetch the price data for the item
*/
export async function fetchItemPriceData(item) {
    const defaultData = {
        count: 1,
        display: { glint: false, lore: [], name: '' },
        id: '',
        tier: null,
        vanillaId: '',
    };
    const fullItem = { ...defaultData, ...item };
    const itemSchema = await getItemUniqueId(fullItem, false, true);
    console.log(fullItem, itemSchema);
    // we couldn't generate a unique id, meaning the item doesn't exist
    if (!itemSchema)
        return null;
    const auctionsQuery = {
        i: itemSchema._id,
        e: fullItem.enchantments,
        r: fullItem.reforge,
    };
    // remove undefined stuff
    Object.keys(auctionsQuery).forEach(key => auctionsQuery[key] === undefined && delete auctionsQuery[key]);
    const auctions = await auctionsCollection.find(auctionsQuery).toArray();
    console.log('auctions:', auctionsQuery, auctions);
    // there's not actually any auctions for the item
    if (auctions.length === 0)
        return null;
    const auctionPrices = auctions.map(a => a.p);
    // find the median
    const medianPrice = auctionPrices.sort((p1, p2) => p1 - p2)[Math.floor(auctions.length / 2)];
    // find the average
    const averagePrice = auctionPrices.reduce((acc, p) => acc + p, 0) / auctions.length;
    return {
        internalId: itemSchema._id,
        item: schemaToItem(itemSchema, fullItem),
        // auctionIds: auctions.map(a => a._id),
        count: auctions.length,
        median: medianPrice,
        average: averagePrice
    };
}
/**
 * Fetch an array of `Item`s that partially match a name.
 */
export async function fetchItemsByName(name, enchantments) {
    // the string regex query we're going to be using, with all regex special characters escaped
    const regexQuery = name.replace(/[.*+?^${}()|[\]\\#:!=]/g, '\\$&');
    // the enchantment things here maybe should be removed?
    const nonNullEnchantments = Object.fromEntries(Object.entries(enchantments)
        .filter(([k, v]) => v !== null));
    // only match enchantments if they're specified
    const enchantmentsMatch = Object.keys(nonNullEnchantments).length > 0 ? {
        $eq: nonNullEnchantments
    } : undefined;
    console.log(enchantmentsMatch);
    const extraMatches = {};
    for (const enchantment of Object.keys(enchantments).filter(e => enchantments[e] === null)) {
        extraMatches[`item.e.${enchantment}`] = { $exists: true };
    }
    console.log('extraMatches', extraMatches);
    const mostSoldMatchingItems = await auctionsCollection.aggregate([
        { $sort: { p: 1 } },
        {
            $group: {
                _id: '$i',
                prices: { $push: '$p' }
            }
        },
        {
            $lookup: {
                from: 'items',
                localField: '_id',
                foreignField: '_id',
                as: 'item'
            }
        },
        // filter the items that match the query
        {
            $match: {
                'item.dn': {
                    $regex: regexQuery,
                    $options: 'i'
                },
                'item.e': enchantmentsMatch,
                ...extraMatches
            }
        },
        {
            $project: {
                prices: 1,
                count: { '$size': ['$prices'] },
                item: { $arrayElemAt: ['$item', 0] }
            }
        },
        // sort and cut off the results at the top 100
        { $sort: { count: -1 } },
        { $limit: 100 },
        // get the average and median
        {
            $project: {
                prices: 1,
                count: 1,
                average: { '$avg': '$prices' },
                median: { '$arrayElemAt': ['$prices', { $floor: { $divide: ['$count', 2] } }] },
                item: 1
            }
        },
    ])
        .toArray();
    return await Promise.all(mostSoldMatchingItems.map(async (i) => {
        const itemSchema = schemaToItem(i.item);
        return {
            internalId: i._id,
            count: i.count,
            median: i.median,
            average: i.average,
            lowestBin: await getItemLowestBin(itemSchema),
            item: itemSchema
        };
    }));
}
let lastUpdatedMostSoldItems = 0;
let cachedMostSoldItems = [];
export async function fetchMostSoldItems() {
    // TODO: lock it so it doesn't do the query multiple times
    if (Date.now() - lastUpdatedMostSoldItems < 60 * 1000)
        return cachedMostSoldItems;
    const mostSoldItems = await auctionsCollection.aggregate([
        { $sort: { p: 1 } },
        {
            $group: {
                _id: '$i',
                prices: { $push: '$p' }
            }
        },
        {
            $project: {
                prices: 1,
                count: { '$size': ['$prices'] }
            }
        },
        // sort and cut off the results at the top 100
        { $sort: { count: -1 } },
        { $limit: 100 },
        {
            $project: {
                prices: 1,
                count: 1,
                average: { '$avg': '$prices' }
            }
        },
        // get the median
        {
            $project: {
                median: { '$arrayElemAt': ['$prices', { $floor: { $divide: ['$count', 2] } }] },
                count: 1,
                average: 1
            }
        },
        {
            $lookup: {
                from: 'items',
                localField: '_id',
                foreignField: '_id',
                as: 'item'
            }
        },
        {
            $project: {
                item: { $arrayElemAt: ['$item', 0] },
                prices: 1,
                median: 1,
                count: 1,
                average: 1
            }
        }
    ])
        .toArray();
    cachedMostSoldItems = await Promise.all(mostSoldItems.map(async (i) => {
        const itemSchema = schemaToItem(i.item);
        return {
            internalId: i._id,
            count: i.count,
            median: i.median,
            average: i.average,
            lowestBin: await getItemLowestBin(itemSchema),
            item: schemaToItem(i.item)
        };
    }));
    lastUpdatedMostSoldItems = Date.now();
    return cachedMostSoldItems;
}
/** Get the price data for an enchantment by searching for enchanted books */
export async function getEnchantmentPriceData(enchantmentName, enchantmentLevel) {
    const enchantments = {};
    enchantments[enchantmentName] = enchantmentLevel;
    return await fetchItemPriceData({
        id: 'ENCHANTED_BOOK',
        enchantments
    });
}
if (client)
    client.connect().then(() => {
        // make sure it's not in a test
        if (!globalThis.isTest) {
            // when it connects, cache the leaderboards and remove bad members
            removeBadMemberLeaderboardAttributes();
            // cache leaderboards on startup so its faster later on
            fetchAllLeaderboards(true);
            // cache leaderboard players again every 4 hours
            setInterval(fetchAllLeaderboards, 4 * 60 * 60 * 1000);
            // add auctions that ended to the database
            addEndedAuctions();
            setInterval(addEndedAuctions, 60 * 1000);
        }
    });
