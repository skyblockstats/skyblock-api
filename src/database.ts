/**
 * Store data about members for leaderboards
*/

import * as constants from './constants'
import * as cached from './hypixelCached'
import { Collection, Db, MongoClient } from 'mongodb'
import NodeCache from 'node-cache'
import { CleanMember } from './cleaners/skyblock/member'
import { CleanPlayer } from './cleaners/player'
import { shuffle } from './util'

// don't update the user for 3 minutes
const recentlyUpdated = new NodeCache({
	stdTTL: 60 * 3,
	checkperiod: 60,
	useClones: false,
})

interface DatabaseLeaderboardItem {
	uuid: string
	stats: any
	last_updated: Date
}

interface LeaderboardItem {
	player: CleanPlayer
	value: number
}

const cachedLeaderboards: Map<string, any> = new Map()


let client: MongoClient
let database: Db
let memberLeaderboardsCollection: Collection<any>

async function connect() {
	if (!process.env.db_uri)
		return console.warn('Warning: db_uri was not found in .env. Features that utilize the database such as leaderboards won\'t work.')
	if (!process.env.db_name)
		return console.warn('Warning: db_name was not found in .env. Features that utilize the database such as leaderboards won\'t work.')
	client = await MongoClient.connect(process.env.db_uri, { useNewUrlParser: true, useUnifiedTopology: true })
	database = client.db(process.env.db_name)
	memberLeaderboardsCollection = database.collection('member-leaderboards')
}


function getMemberCollectionAttributes(member: CleanMember) {
	const collectionAttributes = {}
	for (const collection of member.collections) {
		const collectionLeaderboardName = `collection_${collection.name}`
		collectionAttributes[collectionLeaderboardName] = collection.xp
	}
	return collectionAttributes
}

function getMemberLeaderboardAttributes(member: CleanMember) {
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
	}
}

/** Fetch the names of all the leaderboards */
async function fetchAllMemberLeaderboardAttributes(): Promise<string[]> {
	return [
		// we use the raw stat names rather than the clean stats in case hypixel adds a new stat and it takes a while for us to clean it
		...await constants.fetchStats(),

		// collection leaderboards
		...(await constants.fetchCollections()).map(value => `collection_${value}`),

		'fairy_souls',
		'first_join',
		'purse',
		'visited_zones',
	]
}

export async function fetchMemberLeaderboard(name: string) {
	if (cachedLeaderboards.has(name))
		return cachedLeaderboards.get(name)
	// typescript forces us to make a new variable and set it this way because it gives an error otherwise
	const query = {}
	query[`stats.${name}`] = { '$exists': true }

	const sortQuery: any = {}
	sortQuery[`stats.${name}`] = -1


	const leaderboardRaw = await memberLeaderboardsCollection.find(query).sort(sortQuery).limit(100).toArray()
	const fetchLeaderboardPlayer = async(item: DatabaseLeaderboardItem): Promise<LeaderboardItem> => {
		return {
			player: await cached.fetchPlayer(item.uuid),
			value: item.stats[name]
		}
	}
	const promises: Promise<LeaderboardItem>[] = []
	for (const item of leaderboardRaw) {
		promises.push(fetchLeaderboardPlayer(item))
	}
	const leaderboard = await Promise.all(promises)
	cachedLeaderboards.set(name, leaderboard)
	return leaderboard
}

async function getMemberLeaderboardRequirement(name: string): Promise<number> {
	const leaderboard = await fetchMemberLeaderboard(name)
	// if there's more than 100 items, return the 100th. if there's less, return null
	if (leaderboard.length >= 100)
		return leaderboard[99].value
	else
		return null
}

/** Get the attributes for the member, but only ones that would put them on the top 100 for leaderboards */
async function getApplicableAttributes(member) {
	const leaderboardAttributes = getMemberLeaderboardAttributes(member)
	const applicableAttributes = []
	for (const [ attributeName, attributeValue ] of Object.entries(leaderboardAttributes)) {
		const requirement = await getMemberLeaderboardRequirement(attributeName)
		if (!requirement || attributeValue > requirement)
			applicableAttributes[attributeName] = attributeValue
	}
}

/** Update the member's leaderboard data on the server if applicable */
export async function updateDatabaseMember(member: CleanMember) {
	if (!client) return // the db client hasn't been initialized
	// the member's been updated too recently, just return
	if (recentlyUpdated.get(member.uuid))
		return
	// store the member in recentlyUpdated so it cant update for 3 more minutes
	recentlyUpdated.set(member.uuid, true)

	await constants.addStats(Object.keys(member.rawHypixelStats))
	await constants.addCollections(member.collections.map(value => value.name))

	const leaderboardAttributes = await getApplicableAttributes(member)

	await memberLeaderboardsCollection.updateOne(
		{
			uuid: member.uuid
		}, {
			'$set': {
				'stats': leaderboardAttributes,
				'last_updated': new Date()
			}
		}, {
			upsert: true
		}
	)
}


/**
 * Remove leaderboard attributes for members that wouldn't actually be on the leaderboard. This saves a lot of storage space
 */
async function removeBadMemberLeaderboardAttributes() {
	const leaderboards = await fetchAllMemberLeaderboardAttributes()
	// shuffle so if the application is restarting many times itll still be useful
	for (const leaderboard of shuffle(leaderboards)) {
		// wait 10 seconds so it doesnt use as much ram
		await new Promise(resolve => setTimeout(resolve, 10000))

		const unsetValue = {}
		unsetValue[leaderboard] = ''
		const filter = {}
		const requirement = await getMemberLeaderboardRequirement(leaderboard)
		if (requirement !== null) {
			filter[`stats.${leaderboard}`] = {
				'$lt': requirement
			}
			await memberLeaderboardsCollection.updateMany(
				filter,
				{ '$unset': unsetValue }
			)
		}
	}
}


connect()
	.then(removeBadMemberLeaderboardAttributes)