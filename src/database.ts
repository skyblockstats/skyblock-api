/**
 * Store data about members for leaderboards
*/

import { categorizeStat, getStatUnit } from './cleaners/skyblock/stats'
import { CleanBasicProfile, CleanFullProfile, CleanProfile } from './cleaners/skyblock/profile'
import { CleanMember } from './cleaners/skyblock/member'
import { Collection, Db, MongoClient } from 'mongodb'
import { CleanPlayer } from './cleaners/player'
import * as cached from './hypixelCached'
import * as constants from './constants'
import { shuffle, sleep } from './util'
import NodeCache from 'node-cache'
import Queue from 'queue-promise'
import { debug } from '.'
import { slayerLevels } from './cleaners/skyblock/slayers'

// don't update the user for 3 minutes
const recentlyUpdated = new NodeCache({
	stdTTL: 60 * 3,
	checkperiod: 60,
	useClones: false,
})

interface DatabaseMemberLeaderboardItem {
	uuid: string
	profile: string
	stats: any
	last_updated: Date
}
interface DatabaseProfileLeaderboardItem {
	uuid: string
	/** An array of uuids for each player in the profile */
	players: string[]
	stats: any
	last_updated: Date
}

interface MemberLeaderboardItem {
	player: CleanPlayer
	profileUuid: string
	value: number
}
interface ProfileLeaderboardItem {
	players: CleanPlayer[]
	profileUuid: string
	value: number
}

const cachedRawLeaderboards: Map<string, (DatabaseMemberLeaderboardItem|DatabaseProfileLeaderboardItem)[]> = new Map()

const leaderboardMax = 100
const reversedLeaderboards = [
	'first_join',
	'_best_time', '_best_time_2'
]

let client: MongoClient
let database: Db
let memberLeaderboardsCollection: Collection<any>
let profileLeaderboardsCollection: Collection<any>

async function connect(): Promise<void> {
	if (!process.env.db_uri)
		return console.warn('Warning: db_uri was not found in .env. Features that utilize the database such as leaderboards won\'t work.')
	if (!process.env.db_name)
		return console.warn('Warning: db_name was not found in .env. Features that utilize the database such as leaderboards won\'t work.')
	client = await MongoClient.connect(process.env.db_uri, { useNewUrlParser: true, useUnifiedTopology: true })
	database = client.db(process.env.db_name)
	memberLeaderboardsCollection = database.collection('member-leaderboards')
	profileLeaderboardsCollection = database.collection('profile-leaderboards')
}

interface StringNumber {
	[ name: string]: number
}

function getMemberCollectionAttributes(member: CleanMember): StringNumber {
	const collectionAttributes = {}
	for (const collection of member.collections) {
		const collectionLeaderboardName = `collection_${collection.name}`
		collectionAttributes[collectionLeaderboardName] = collection.xp
	}
	return collectionAttributes
}

function getMemberSkillAttributes(member: CleanMember): StringNumber {
	const skillAttributes = {}
	for (const collection of member.skills) {
		const skillLeaderboardName = `skill_${collection.name}`
		skillAttributes[skillLeaderboardName] = collection.xp
	}
	return skillAttributes
}

function getMemberSlayerAttributes(member: CleanMember): StringNumber {
	const slayerAttributes: StringNumber = {
		slayer_total_xp: member.slayers.xp,
		slayer_total_kills: member.slayers.kills,
	}

	for (const slayer of member.slayers.bosses) {
		slayerAttributes[`slayer_${slayer.raw_name}_total_xp`] = slayer.xp
		slayerAttributes[`slayer_${slayer.raw_name}_total_kills`] = slayer.kills
		for (const tier of slayer.tiers) {
			slayerAttributes[`slayer_${slayer.raw_name}_${tier.tier}_kills`] = tier.kills
		}
	}

	return slayerAttributes
}

function getMemberLeaderboardAttributes(member: CleanMember): StringNumber {
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
	}
}

function getProfileLeaderboardAttributes(profile: CleanFullProfile): StringNumber {
	// if you want to add a new leaderboard for member attributes, add it here (and getAllLeaderboardAttributes)
	return {
		minion_count: profile.minion_count
	}
}


export async function fetchAllLeaderboardsCategorized(): Promise<{ [ category: string ]: string[] }> {
	const memberLeaderboardAttributes: string[] = await fetchAllMemberLeaderboardAttributes()
	const profileLeaderboardAttributes: string[] = await fetchAllProfileLeaderboardAttributes()

	const categorizedLeaderboards: { [ category: string ]: string[] } = {}
	for (const leaderboard of [...memberLeaderboardAttributes, ...profileLeaderboardAttributes]) {
		const { category } = categorizeStat(leaderboard)
		if (!categorizedLeaderboards[category])
			categorizedLeaderboards[category] = []
		categorizedLeaderboards[category].push(leaderboard)
	}

	// move misc to end by removing and readding it
	const misc = categorizedLeaderboards.misc
	delete categorizedLeaderboards.misc
	categorizedLeaderboards.misc = misc

	return categorizedLeaderboards
}

/** Fetch the raw names for the slayer leaderboards */
export async function fetchSlayerLeaderboards(): Promise<string[]> {
	const rawSlayerNames = await constants.fetchSlayers()
	let leaderboardNames: string[] = [
		'slayer_total_xp',
		'slayer_total_kills'
	]

	// we use the raw names (zombie, spider, wolf) instead of the clean names (revenant, tarantula, sven) because the raw names are guaranteed to never change
	for (const slayerNameRaw of rawSlayerNames) {
		leaderboardNames.push(`slayer_${slayerNameRaw}_total_xp`)
		leaderboardNames.push(`slayer_${slayerNameRaw}_total_kills`)
		for (let slayerTier = 1; slayerTier <= slayerLevels; slayerTier ++) {
			leaderboardNames.push(`slayer_${slayerNameRaw}_${slayerTier}_kills`)
		}
	}

	return leaderboardNames
}

/** Fetch the names of all the leaderboards that rank members */
export async function fetchAllMemberLeaderboardAttributes(): Promise<string[]> {
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
		'leaderboards_count'
	]
}

/** Fetch the names of all the leaderboards that rank profiles */
async function fetchAllProfileLeaderboardAttributes(): Promise<string[]> {
	return [
		'minion_count'
	]
}

function isLeaderboardReversed(name: string): boolean {
	for (const leaderboardMatch of reversedLeaderboards) {
		let trailingEnd = leaderboardMatch[0] === '_'
		let trailingStart = leaderboardMatch.substr(-1) === '_'
		if (
			(trailingStart && name.startsWith(leaderboardMatch))
			|| (trailingEnd && name.endsWith(leaderboardMatch))
			|| (name == leaderboardMatch)
		)
			return true
	}
	return false
}

async function fetchMemberLeaderboardRaw(name: string): Promise<DatabaseMemberLeaderboardItem[]> {
	if (!client) throw Error('Client isn\'t initialized yet')

	if (cachedRawLeaderboards.has(name))
		return cachedRawLeaderboards.get(name) as DatabaseMemberLeaderboardItem[]
	// typescript forces us to make a new variable and set it this way because it gives an error otherwise
	const query = {}
	query[`stats.${name}`] = { '$exists': true, '$ne': NaN }

	const sortQuery: any = {}
	sortQuery[`stats.${name}`] = isLeaderboardReversed(name) ? 1 : -1

	const leaderboardRaw: DatabaseMemberLeaderboardItem[] = await memberLeaderboardsCollection
		.find(query)
		.sort(sortQuery)
		.limit(leaderboardMax)
		.toArray()

	cachedRawLeaderboards.set(name, leaderboardRaw)
	return leaderboardRaw
}

async function fetchProfileLeaderboardRaw(name: string): Promise<DatabaseProfileLeaderboardItem[]> {
	if (cachedRawLeaderboards.has(name))
		return cachedRawLeaderboards.get(name) as DatabaseProfileLeaderboardItem[]
	// typescript forces us to make a new variable and set it this way because it gives an error otherwise
	const query = {}
	query[`stats.${name}`] = { '$exists': true, '$ne': NaN }

	const sortQuery: any = {}
	sortQuery[`stats.${name}`] = isLeaderboardReversed(name) ? 1 : -1

	const leaderboardRaw: DatabaseProfileLeaderboardItem[] = await profileLeaderboardsCollection
		.find(query)
		.sort(sortQuery)
		.limit(leaderboardMax)
		.toArray()

	cachedRawLeaderboards.set(name, leaderboardRaw)
	return leaderboardRaw
}

interface MemberLeaderboard {
	name: string
	unit?: string
	list: MemberLeaderboardItem[]
}

interface ProfileLeaderboard {
	name: string
	unit?: string
	list: ProfileLeaderboardItem[]
}


/** Fetch a leaderboard that ranks members, as opposed to profiles */
export async function fetchMemberLeaderboard(name: string): Promise<MemberLeaderboard> {
	const leaderboardRaw = await fetchMemberLeaderboardRaw(name)

	const fetchLeaderboardPlayer = async(item: DatabaseMemberLeaderboardItem): Promise<MemberLeaderboardItem> => {
		return {
			player: await cached.fetchBasicPlayer(item.uuid),
			profileUuid: item.profile,
			value: item.stats[name]
		}
	}
	const promises: Promise<MemberLeaderboardItem>[] = []
	for (const item of leaderboardRaw) {
		promises.push(fetchLeaderboardPlayer(item))
	}
	const leaderboard = await Promise.all(promises)
	return {
		name: name,
		unit: getStatUnit(name) ?? null,
		list: leaderboard
	}
}


/** Fetch a leaderboard that ranks profiles, as opposed to members */
export async function fetchProfileLeaderboard(name: string): Promise<ProfileLeaderboard> {
	const leaderboardRaw = await fetchProfileLeaderboardRaw(name)

	const fetchLeaderboardProfile = async(item: DatabaseProfileLeaderboardItem): Promise<ProfileLeaderboardItem> => {
		const players = []
		for (const playerUuid of item.players)
			players.push(await cached.fetchBasicPlayer(playerUuid))
		return {
			players: players,
			profileUuid: item.uuid,
			value: item.stats[name]
		}
	}
	const promises: Promise<ProfileLeaderboardItem>[] = []
	for (const item of leaderboardRaw) {
		promises.push(fetchLeaderboardProfile(item))
	}
	const leaderboard = await Promise.all(promises)
	return {
		name: name,
		unit: getStatUnit(name) ?? null,
		list: leaderboard
	}
}

/** Fetch a leaderboard */
export async function fetchLeaderboard(name: string): Promise<MemberLeaderboard|ProfileLeaderboard> {
	const profileLeaderboards = await fetchAllProfileLeaderboardAttributes()
	if (profileLeaderboards.includes(name)) {
		return await fetchProfileLeaderboard(name)
	} else {
		return await fetchMemberLeaderboard(name)
	}
}

/** Get the leaderboard positions a member is on. This may take a while depending on whether stuff is cached */
export async function fetchMemberLeaderboardSpots(player: string, profile: string) {
	const fullProfile = await cached.fetchProfile(player, profile)
	const fullMember = fullProfile.members.find(m => m.username.toLowerCase() === player.toLowerCase() || m.uuid === player)

	// update the leaderboard positions for the member
	await updateDatabaseMember(fullMember, fullProfile)

	const applicableAttributes = await getApplicableMemberLeaderboardAttributes(fullMember)

	const memberLeaderboardSpots = []

	for (const leaderboardName in applicableAttributes) {
		const leaderboard = await fetchMemberLeaderboardRaw(leaderboardName)
		const leaderboardPositionIndex = leaderboard.findIndex(i => i.uuid === fullMember.uuid && i.profile === fullProfile.uuid)

		memberLeaderboardSpots.push({
			name: leaderboardName,
			positionIndex: leaderboardPositionIndex,
			value: applicableAttributes[leaderboardName],
			unit: getStatUnit(leaderboardName) ?? null
		})
	}

	return memberLeaderboardSpots
}

async function getLeaderboardRequirement(name: string, leaderboardType: 'member' | 'profile'): Promise<number> {
	let leaderboard: DatabaseMemberLeaderboardItem[] | DatabaseProfileLeaderboardItem[]
	if (leaderboardType === 'member')
		leaderboard = await fetchMemberLeaderboardRaw(name)
	else if (leaderboardType === 'profile')
		leaderboard = await fetchProfileLeaderboardRaw(name)

	// if there's more than 100 items, return the 100th. if there's less, return null
	if (leaderboard.length >= leaderboardMax)
		return leaderboard[leaderboardMax - 1].stats[name]
	else
		return null
}

/** Get the attributes for the member, but only ones that would put them on the top 100 for leaderboards */
async function getApplicableMemberLeaderboardAttributes(member: CleanMember): Promise<StringNumber> {
	const leaderboardAttributes = getMemberLeaderboardAttributes(member)
	const applicableAttributes = {}

	for (const [ leaderboard, attributeValue ] of Object.entries(leaderboardAttributes)) {
		const requirement = await getLeaderboardRequirement(leaderboard, 'member')
		const leaderboardReversed = isLeaderboardReversed(leaderboard)
		if (
			(requirement === null)
			|| (leaderboardReversed ? attributeValue < requirement : attributeValue > requirement)
		) {
			applicableAttributes[leaderboard] = attributeValue
		}
	}


	let leaderboardsCount: number = Object.keys(applicableAttributes).length
	const leaderboardsCountRequirement: number = await getLeaderboardRequirement('leaderboards_count', 'member')

	if (
		(leaderboardsCountRequirement === null)
		|| (leaderboardsCount > leaderboardsCountRequirement)
	) {
		applicableAttributes['leaderboards_count'] = leaderboardsCount
	}

	return applicableAttributes
}

/** Get the attributes for the profile, but only ones that would put them on the top 100 for leaderboards */
async function getApplicableProfileLeaderboardAttributes(profile: CleanFullProfile): Promise<StringNumber> {
	const leaderboardAttributes = getProfileLeaderboardAttributes(profile)
	const applicableAttributes = {}

	for (const [ leaderboard, attributeValue ] of Object.entries(leaderboardAttributes)) {
		const requirement = await getLeaderboardRequirement(leaderboard, 'profile')
		const leaderboardReversed = isLeaderboardReversed(leaderboard)
		if (
			(requirement === null)
			|| (leaderboardReversed ? attributeValue < requirement : attributeValue > requirement)
		) {
			applicableAttributes[leaderboard] = attributeValue
		}
	}


	let leaderboardsCount: number = Object.keys(applicableAttributes).length
	const leaderboardsCountRequirement: number = await getLeaderboardRequirement('leaderboards_count', 'member')

	if (
		(leaderboardsCountRequirement === null)
		|| (leaderboardsCount > leaderboardsCountRequirement)
	) {
		applicableAttributes['leaderboards_count'] = leaderboardsCount
	}

	return applicableAttributes
}

/** Update the member's leaderboard data on the server if applicable */
export async function updateDatabaseMember(member: CleanMember, profile: CleanFullProfile): Promise<void> {
	if (debug) console.log('updateDatabaseMember', member.username)
	if (!client) return // the db client hasn't been initialized
	// the member's been updated too recently, just return
	if (recentlyUpdated.get(profile.uuid + member.uuid))
		return
	// store the member in recentlyUpdated so it cant update for 3 more minutes
	recentlyUpdated.set(profile.uuid + member.uuid, true)

	if (debug) console.log('adding member to leaderboards', member.username)

	await constants.addStats(Object.keys(member.rawHypixelStats))
	await constants.addCollections(member.collections.map(coll => coll.name))
	await constants.addSkills(member.skills.map(skill => skill.name))
	await constants.addZones(member.visited_zones.map(zone => zone.name))
	await constants.addSlayers(member.slayers.bosses.map(s => s.raw_name))

	if (debug) console.log('done constants..')

	const leaderboardAttributes = await getApplicableMemberLeaderboardAttributes(member)

	if (debug) console.log('done getApplicableMemberLeaderboardAttributes..', leaderboardAttributes, member.username, profile.name)

	await memberLeaderboardsCollection.updateOne(
		{
			uuid: member.uuid,
			profile: profile.uuid
		},
		{
			'$set': {
				stats: leaderboardAttributes,
				last_updated: new Date()
			}
		},
		{ upsert: true }
	)

	for (const [ attributeName, attributeValue ] of Object.entries(leaderboardAttributes)) {
		const existingRawLeaderboard = await fetchMemberLeaderboardRaw(attributeName)
		const leaderboardReverse = isLeaderboardReversed(attributeName)
		const newRawLeaderboard = existingRawLeaderboard
			// remove the player from the leaderboard, if they're there
			.filter(value => value.uuid !== member.uuid || value.profile !== profile.uuid)
			.concat([{
				last_updated: new Date(),
				stats: leaderboardAttributes,
				uuid: member.uuid,
				profile: profile.uuid
			}])
			.sort((a, b) => leaderboardReverse ? a.stats[attributeName] - b.stats[attributeName] : b.stats[attributeName] - a.stats[attributeName])
			.slice(0, 100)
		cachedRawLeaderboards.set(attributeName, newRawLeaderboard)
	}

	if (debug) console.log('added member to leaderboards', member.username, leaderboardAttributes)
}

/**
 * Update the profiles's leaderboard data on the server if applicable.
 * This will not also update the members, you have to call updateDatabaseMember separately for that
 */
export async function updateDatabaseProfile(profile: CleanFullProfile): Promise<void> {
	if (debug) console.log('updateDatabaseProfile', profile.name)
	if (!client) return // the db client hasn't been initialized

	// the profile's been updated too recently, just return
	if (recentlyUpdated.get(profile.uuid + 'profile'))
		return
	// store the profile in recentlyUpdated so it cant update for 3 more minutes
	recentlyUpdated.set(profile.uuid + 'profile', true)

	if (debug) console.log('adding profile to leaderboards', profile.name)

	const leaderboardAttributes = await getApplicableProfileLeaderboardAttributes(profile)

	if (debug) console.log('done getApplicableProfileLeaderboardAttributes..', leaderboardAttributes, profile.name)

	await profileLeaderboardsCollection.updateOne(
		{
			uuid: profile.uuid
		},
		{
			'$set': {
				players: profile.members.map(p => p.uuid),
				stats: leaderboardAttributes,
				last_updated: new Date()
			}
		},
		{ upsert: true }
	)

	// add the profile to the cached leaderboard without having to refetch it
	for (const [ attributeName, attributeValue ] of Object.entries(leaderboardAttributes)) {
		const existingRawLeaderboard = await fetchProfileLeaderboardRaw(attributeName)
		const leaderboardReverse = isLeaderboardReversed(attributeName)
		const newRawLeaderboard = existingRawLeaderboard
			// remove the player from the leaderboard, if they're there
			.filter(value => value.uuid !== profile.uuid)
			.concat([{
				last_updated: new Date(),
				stats: leaderboardAttributes,
				uuid: profile.uuid,
				players: profile.members.map(p => p.uuid)
			}])
			.sort((a, b) => leaderboardReverse ? a.stats[attributeName] - b.stats[attributeName] : b.stats[attributeName] - a.stats[attributeName])
			.slice(0, 100)
		cachedRawLeaderboards.set(attributeName, newRawLeaderboard)
	}

	if (debug) console.log('added profile to leaderboards', profile.name, leaderboardAttributes)
}

const leaderboardUpdateMemberQueue = new Queue({
	concurrent: 1,
	interval: 500
})
const leaderboardUpdateProfileQueue = new Queue({
	concurrent: 1,
	interval: 2000
})

/** Queue an update for the member's leaderboard data on the server if applicable */
export async function queueUpdateDatabaseMember(member: CleanMember, profile: CleanFullProfile): Promise<void> {
	leaderboardUpdateMemberQueue.enqueue(async() => await updateDatabaseMember(member, profile))
}

/** Queue an update for the profile's leaderboard data on the server if applicable */
export async function queueUpdateDatabaseProfile(profile: CleanFullProfile): Promise<void> {
	leaderboardUpdateProfileQueue.enqueue(async() => await updateDatabaseProfile(profile))
}


/**
 * Remove leaderboard attributes for members that wouldn't actually be on the leaderboard. This saves a lot of storage space
 */
async function removeBadMemberLeaderboardAttributes(): Promise<void> {
	const leaderboards: string[] = await fetchAllMemberLeaderboardAttributes()
	// shuffle so if the application is restarting many times itll still be useful

	for (const leaderboard of shuffle(leaderboards)) {
		// wait 10 seconds so it doesnt use as much ram
		await sleep(10 * 1000)

		const unsetValue = {}
		unsetValue[leaderboard] = ''
		const filter = {}
		const requirement = await getLeaderboardRequirement(leaderboard, 'member')
		const leaderboardReversed = isLeaderboardReversed(leaderboard)
		if (requirement !== null) {
			filter[`stats.${leaderboard}`] = {
				'$lt': leaderboardReversed ? undefined : requirement,
				'$gt': leaderboardReversed ? requirement : undefined
			}
			await memberLeaderboardsCollection.updateMany(
				filter,
				{ '$unset': unsetValue }
			)
		}
	}
}

/** Fetch all the leaderboards, used for caching. Don't call this often! */
async function fetchAllLeaderboards(fast?: boolean): Promise<void> {
	const leaderboards: string[] = await fetchAllMemberLeaderboardAttributes()

	// shuffle so if the application is restarting many times itll still be useful
	if (debug) console.log('Caching leaderboards!')
	for (const leaderboard of shuffle(leaderboards)) {
		if (!fast)
			// wait 2 seconds so it doesnt use as much ram
			await sleep(2 * 1000)

		await fetchMemberLeaderboard(leaderboard)
	}
	if (debug) console.log('Finished caching leaderboards!')
}

// make sure it's not in a test
if (typeof global.it !== 'function') {
	connect().then(() => {
		// when it connects, cache the leaderboards and remove bad members
		removeBadMemberLeaderboardAttributes()
		// cache leaderboards on startup so its faster later on
		fetchAllLeaderboards(true)
		// cache leaderboard players again every 4 hours
		setInterval(fetchAllLeaderboards, 4 * 60 * 60 * 1000)
	})
}
