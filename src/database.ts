/**
 * Store data about members for leaderboards
*/

import { categorizeStat, getStatUnit } from './cleaners/skyblock/stats.js'
import { CleanFullProfile } from './cleaners/skyblock/profile.js'
import { slayerLevels } from './cleaners/skyblock/slayers.js'
import { CleanMember } from './cleaners/skyblock/member.js'
import { Collection, Db, Filter, MongoClient, WithId } from 'mongodb'
import { CleanPlayer } from './cleaners/player.js'
import * as cached from './hypixelCached.js'
import * as constants from './constants.js'
import { shuffle, sleep } from './util.js'
import * as discord from './discord.js'
import NodeCache from 'node-cache'
import { v4 as uuid4 } from 'uuid'
import Queue from 'queue-promise'
import { debug } from './index.js'

// don't update the user for 3 minutes
const recentlyUpdated = new NodeCache({
	stdTTL: 60 * 3,
	checkperiod: 60,
	useClones: false,
})

// don't add stuff to the queue within the same 5 minutes
const recentlyQueued = new NodeCache({
	stdTTL: 60 * 5,
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


interface memberRawLeaderboardItem {
	uuid: string
	profile: string
	value: number
}
interface profileRawLeaderboardItem {
	uuid: string
	/** An array of uuids for each player in the profile */
	players: string[]
	value: number
}

interface MemberLeaderboardItem {
	player: CleanPlayer | null
	profileUuid: string
	value: number
}
interface ProfileLeaderboardItem {
	players: CleanPlayer[]
	profileUuid: string
	value: number
}

export const cachedRawLeaderboards: Map<string, (memberRawLeaderboardItem|profileRawLeaderboardItem)[]> = new Map()

const leaderboardMax = 100
const reversedLeaderboards = [
	'first_join',
	'_best_time', '_best_time_2'
]

let client: MongoClient
let database: Db

interface SessionSchema {
	_id?: string
	refresh_token: string
	discord_user: {
		id: string
		name: string
	}
	lastUpdated: Date
}

export interface AccountCustomization {
	backgroundUrl?: string
	pack?: string
}

export interface AccountSchema {
	_id?: string
	discordId: string
	minecraftUuid?: string
	customization?: AccountCustomization
}

let memberLeaderboardsCollection: Collection<DatabaseMemberLeaderboardItem>
let profileLeaderboardsCollection: Collection<DatabaseProfileLeaderboardItem>
let sessionsCollection: Collection<SessionSchema>
let accountsCollection: Collection<AccountSchema>


const leaderboardInfos: { [ leaderboardName: string ]: string } = {
	highest_crit_damage: 'This leaderboard is capped at the integer limit because Hypixel, look at the <a href="/leaderboard/highest_critical_damage">highest critical damage leaderboard</a> instead.',
	highest_critical_damage: 'uhhhhh yeah idk either',
	leaderboards_count: 'This leaderboard counts how many leaderboards players are in the top 100 for.',
	top_1_leaderboards_count: 'This leaderboard counts how many leaderboards players are #1 for.',
	skill_social: 'This leaderboard is inaccurate because Hypixel only shows social skill data on some API profiles.'
}


async function connect(): Promise<void> {
	if (!process.env.db_uri)
		return console.warn('Warning: db_uri was not found in .env. Features that utilize the database such as leaderboards won\'t work.')
	if (!process.env.db_name)
		return console.warn('Warning: db_name was not found in .env. Features that utilize the database such as leaderboards won\'t work.')
	client = await MongoClient.connect(process.env.db_uri)
	database = client.db(process.env.db_name)
	memberLeaderboardsCollection = database.collection('member-leaderboards')
	profileLeaderboardsCollection = database.collection('profile-leaderboards')
	sessionsCollection = database.collection('sessions')
	accountsCollection = database.collection('accounts')
	console.log('Connected to database :)')
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
		unique_minions: profile.minion_count
	}
}


export async function fetchAllLeaderboardsCategorized(): Promise<{ [ category: string ]: string[] }> {
	const memberLeaderboardAttributes: string[] = await fetchAllMemberLeaderboardAttributes()
	const profileLeaderboardAttributes: string[] = await fetchAllProfileLeaderboardAttributes()

	const categorizedLeaderboards: { [ category: string ]: string[] } = {}
	for (const leaderboard of [...memberLeaderboardAttributes, ...profileLeaderboardAttributes]) {
		const { category } = categorizeStat(leaderboard)
		if (category) {
			if (!categorizedLeaderboards[category])
				categorizedLeaderboards[category] = []
			categorizedLeaderboards[category].push(leaderboard)
		}
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
		'leaderboards_count',
		'top_1_leaderboards_count'
	]
}

/** Fetch the names of all the leaderboards that rank profiles */
async function fetchAllProfileLeaderboardAttributes(): Promise<string[]> {
	return [
		'unique_minions'
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

/** A set of names of the raw leaderboards that are currently being fetched. This is used to make sure two leaderboads aren't fetched at the same time */
const fetchingRawLeaderboardNames: Set<string> = new Set()

async function fetchMemberLeaderboardRaw(name: string): Promise<memberRawLeaderboardItem[]> {
	if (!client) throw Error('Client isn\'t initialized yet')

	if (cachedRawLeaderboards.has(name))
		return cachedRawLeaderboards.get(name) as memberRawLeaderboardItem[]
	
	// if it's currently being fetched, check every 100ms until it's in cachedRawLeaderboards
	if (fetchingRawLeaderboardNames.has(name)) {
		while (true) {
			await sleep(100)
			if (cachedRawLeaderboards.has(name))
				return cachedRawLeaderboards.get(name) as memberRawLeaderboardItem[]
		}
	}

	// typescript forces us to make a new variable and set it this way because it gives an error otherwise
	const query = {}
	query[`stats.${name}`] = { '$exists': true, '$ne': NaN }

	const sortQuery: any = {}
	sortQuery[`stats.${name}`] = isLeaderboardReversed(name) ? 1 : -1

	fetchingRawLeaderboardNames.add(name)
	const leaderboardRaw: memberRawLeaderboardItem[] = (await memberLeaderboardsCollection
		.find(query)
		.sort(sortQuery)
		.limit(leaderboardMax)
		.toArray())
		.map((i: DatabaseMemberLeaderboardItem): memberRawLeaderboardItem => {
			return {
				profile: i.profile,
				uuid: i.uuid,
				value: i.stats[name]
			}
		})
	fetchingRawLeaderboardNames.delete(name)
	cachedRawLeaderboards.set(name, leaderboardRaw)
	return leaderboardRaw
}

async function fetchProfileLeaderboardRaw(name: string): Promise<profileRawLeaderboardItem[]> {
	if (cachedRawLeaderboards.has(name))
		return cachedRawLeaderboards.get(name) as profileRawLeaderboardItem[]

	// if it's currently being fetched, check every 100ms until it's in cachedRawLeaderboards
	if (fetchingRawLeaderboardNames.has(name)) {
		while (true) {
			await sleep(100)
			if (cachedRawLeaderboards.has(name))
				return cachedRawLeaderboards.get(name) as profileRawLeaderboardItem[]
		}
	}

	// typescript forces us to make a new variable and set it this way because it gives an error otherwise
	const query = {}
	query[`stats.${name}`] = { '$exists': true, '$ne': NaN }

	const sortQuery: any = {}
	sortQuery[`stats.${name}`] = isLeaderboardReversed(name) ? 1 : -1

	fetchingRawLeaderboardNames.add(name)
	const leaderboardRaw: profileRawLeaderboardItem[] = (await profileLeaderboardsCollection
		.find(query)
		.sort(sortQuery)
		.limit(leaderboardMax)
		.toArray())
		.map((i: DatabaseProfileLeaderboardItem): profileRawLeaderboardItem => {
			return {
				players: i.players,
				uuid: i.uuid,
				value: i.stats[name]
			}
		})
	fetchingRawLeaderboardNames.delete(name)

	cachedRawLeaderboards.set(name, leaderboardRaw)
	return leaderboardRaw
}

interface MemberLeaderboard {
	name: string
	unit: string | null
	list: MemberLeaderboardItem[]
	info?: string
}

interface ProfileLeaderboard {
	name: string
	unit: string | null
	list: ProfileLeaderboardItem[]
	info?: string
}


/** Fetch a leaderboard that ranks members, as opposed to profiles */
export async function fetchMemberLeaderboard(name: string): Promise<MemberLeaderboard> {
	const leaderboardRaw = await fetchMemberLeaderboardRaw(name)

	const fetchLeaderboardPlayer = async(i: memberRawLeaderboardItem): Promise<MemberLeaderboardItem> => {
		const player = await cached.fetchBasicPlayer(i.uuid)
		return {
			player,
			profileUuid: i.profile,
			value: i.value
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

	const fetchLeaderboardProfile = async(i: profileRawLeaderboardItem): Promise<ProfileLeaderboardItem> => {
		const players: CleanPlayer[] = []
		for (const playerUuid of i.players) {
			const player = await cached.fetchBasicPlayer(playerUuid)
			if (player)
				players.push(player)
		}
		return {
			players: players,
			profileUuid: i.uuid,
			value: i.value
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
	let leaderboard: MemberLeaderboard|ProfileLeaderboard
	if (profileLeaderboards.includes(name)) {
		leaderboard = await fetchProfileLeaderboard(name)
	} else {
		leaderboard = await fetchMemberLeaderboard(name)
	}

	if (leaderboardInfos[name])
		leaderboard.info = leaderboardInfos[name]

	return leaderboard
}

interface LeaderboardSpot {
	name: string
	positionIndex: number
	value: number
	unit: string | null
}

/** Get the leaderboard positions a member is on. This may take a while depending on whether stuff is cached */
export async function fetchMemberLeaderboardSpots(player: string, profile: string): Promise<LeaderboardSpot[] | null> {
	const fullProfile = await cached.fetchProfile(player, profile)
	if (!fullProfile) return null
	const fullMember = fullProfile.members.find(m => m.username.toLowerCase() === player.toLowerCase() || m.uuid === player)
	if (!fullMember) return null

	// update the leaderboard positions for the member
	await updateDatabaseMember(fullMember, fullProfile)

	const applicableAttributes = await getApplicableMemberLeaderboardAttributes(fullMember)

	const memberLeaderboardSpots: LeaderboardSpot[] = []

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

async function getLeaderboardRequirement(name: string, leaderboardType: 'member' | 'profile'): Promise<{ top_100: number | null, top_1: number | null }> {
	let leaderboard: memberRawLeaderboardItem[] | profileRawLeaderboardItem[]
	if (leaderboardType === 'member')
		leaderboard = await fetchMemberLeaderboardRaw(name)
	else if (leaderboardType === 'profile')
		leaderboard = await fetchProfileLeaderboardRaw(name)

	// if there's more than 100 items, return the 100th. if there's less, return null
	return {
		top_100: leaderboard![leaderboardMax - 1]?.value ?? null,
		top_1: leaderboard![1]?.value ?? null
	}
}

/** Get the attributes for the member, but only ones that would put them on the top 100 for leaderboards */
async function getApplicableMemberLeaderboardAttributes(member: CleanMember): Promise<StringNumber> {
	const leaderboardAttributes = getMemberLeaderboardAttributes(member)
	const applicableAttributes = {}
	const applicableTop1Attributes = {}

	for (const [ leaderboard, attributeValue ] of Object.entries(leaderboardAttributes)) {
		const requirement = await getLeaderboardRequirement(leaderboard, 'member')
		const leaderboardReversed = isLeaderboardReversed(leaderboard)
		if (
			(requirement.top_100 === null)
			|| (
				leaderboardReversed ? attributeValue < requirement.top_100 : attributeValue > requirement.top_100)
		) {
			applicableAttributes[leaderboard] = attributeValue
		}
		if (
			(requirement.top_1 === null)
			|| (leaderboardReversed ? attributeValue < requirement.top_1 : attributeValue > requirement.top_1)
		) {
			applicableTop1Attributes[leaderboard] = attributeValue
		}
	}

	// add the "leaderboards count" attribute
	const leaderboardsCount: number = Object.keys(applicableAttributes).length
	const leaderboardsCountRequirement = await getLeaderboardRequirement('leaderboards_count', 'member')

	if (
		leaderboardsCount > 0
		&& (
			(leaderboardsCountRequirement.top_100 === null)
			|| (leaderboardsCount > leaderboardsCountRequirement.top_100)
		)
	)
		applicableAttributes['leaderboards_count'] = leaderboardsCount
	
	// add the "first leaderboards count" attribute
	const top1LeaderboardsCount: number = Object.keys(applicableTop1Attributes).length
	const top1LeaderboardsCountRequirement = await getLeaderboardRequirement('top_1_leaderboards_count', 'member')

	if (
		top1LeaderboardsCount > 0
		&& (
			(top1LeaderboardsCountRequirement.top_100 === null)
			|| (top1LeaderboardsCount > top1LeaderboardsCountRequirement.top_100)
		)
	)
		applicableAttributes['top_1_leaderboards_count'] = top1LeaderboardsCount
	return applicableAttributes
}

/** Get the attributes for the profile, but only ones that would put them on the top 100 for leaderboards */
async function getApplicableProfileLeaderboardAttributes(profile: CleanFullProfile): Promise<StringNumber> {
	const leaderboardAttributes = getProfileLeaderboardAttributes(profile)
	const applicableAttributes = {}
	const applicableTop1Attributes = {}

	for (const [ leaderboard, attributeValue ] of Object.entries(leaderboardAttributes)) {
		const requirement = await getLeaderboardRequirement(leaderboard, 'profile')
		const leaderboardReversed = isLeaderboardReversed(leaderboard)
		if (
			(requirement.top_100 === null)
			|| (
				leaderboardReversed ? attributeValue < requirement.top_100 : attributeValue > requirement.top_100
				&& attributeValue !== 0
			)
		) {
			applicableAttributes[leaderboard] = attributeValue
		}
		if (
			(requirement.top_1 === null)
			|| (
				leaderboardReversed ? attributeValue < requirement.top_1 : attributeValue > requirement.top_1
				&& attributeValue !== 0
			)
		) {
			applicableTop1Attributes[leaderboard] = attributeValue
		}
	}

	return applicableAttributes
}

/** Update the member's leaderboard data on the server if applicable */
export async function updateDatabaseMember(member: CleanMember, profile: CleanFullProfile): Promise<void> {
	if (!client) return // the db client hasn't been initialized
	if (debug) console.debug('updateDatabaseMember', member.username)
	// the member's been updated too recently, just return
	if (recentlyUpdated.get(profile.uuid + member.uuid)) return
	// store the member in recentlyUpdated so it cant update for 3 more minutes
	recentlyUpdated.set(profile.uuid + member.uuid, true)

	if (debug) console.debug('adding member to leaderboards', member.username)

	if (member.rawHypixelStats)
		await constants.addStats(Object.keys(member.rawHypixelStats))
	await constants.addCollections(member.collections.map(coll => coll.name))
	await constants.addSkills(member.skills.map(skill => skill.name))
	await constants.addZones(member.visited_zones.map(zone => zone.name))
	await constants.addSlayers(member.slayers.bosses.map(s => s.raw_name))

	if (debug) console.debug('done constants..')

	const leaderboardAttributes = await getApplicableMemberLeaderboardAttributes(member)

	if (debug) console.debug('done getApplicableMemberLeaderboardAttributes..', leaderboardAttributes, member.username, profile.name)

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
				value: attributeValue,
				uuid: member.uuid,
				profile: profile.uuid
			}])
			.sort((a, b) => leaderboardReverse ? a.value - b.value : b.value - a.value)
			.slice(0, 100)
		cachedRawLeaderboards.set(attributeName, newRawLeaderboard)
	}

	if (debug) console.debug('added member to leaderboards', member.username, leaderboardAttributes)
}

/**
 * Update the profiles's leaderboard data on the server if applicable.
 * This will not also update the members, you have to call updateDatabaseMember separately for that
 */
export async function updateDatabaseProfile(profile: CleanFullProfile): Promise<void> {
	if (!client) return // the db client hasn't been initialized
	if (debug) console.debug('updateDatabaseProfile', profile.name)

	// the profile's been updated too recently, just return
	if (recentlyUpdated.get(profile.uuid + 'profile'))
		return
	// store the profile in recentlyUpdated so it cant update for 3 more minutes
	recentlyUpdated.set(profile.uuid + 'profile', true)

	if (debug) console.debug('adding profile to leaderboards', profile.name)

	const leaderboardAttributes = await getApplicableProfileLeaderboardAttributes(profile)

	if (debug) console.debug('done getApplicableProfileLeaderboardAttributes..', leaderboardAttributes, profile.name)

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
				value: attributeValue,
				uuid: profile.uuid,
				players: profile.members.map(p => p.uuid)
			}])
			.sort((a, b) => leaderboardReverse ? a.value - b.value : b.value - a.value)
			.slice(0, 100)
		cachedRawLeaderboards.set(attributeName, newRawLeaderboard)
	}

	if (debug) console.debug('added profile to leaderboards', profile.name, leaderboardAttributes)
}

export const leaderboardUpdateMemberQueue = new Queue({
	concurrent: 1,
	interval: 50
})
export const leaderboardUpdateProfileQueue = new Queue({
	concurrent: 1,
	interval: 500
})

/** Queue an update for the member's leaderboard data on the server if applicable */
export function queueUpdateDatabaseMember(member: CleanMember, profile: CleanFullProfile): void {
	if (recentlyQueued.get(profile.uuid + member.uuid)) return
	else recentlyQueued.set(profile.uuid + member.uuid, true)
	leaderboardUpdateMemberQueue.enqueue(async() => await updateDatabaseMember(member, profile))
}

/** Queue an update for the profile's leaderboard data on the server if applicable */
export function queueUpdateDatabaseProfile(profile: CleanFullProfile): void {
	if (recentlyQueued.get(profile.uuid + 'profile')) return
	else recentlyQueued.set(profile.uuid + 'profile', true)
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

	await memberLeaderboardsCollection.deleteMany({ stats: {} })
	await profileLeaderboardsCollection.deleteMany({ stats: {} })

}

export let finishedCachingRawLeaderboards = false

/** Fetch all the leaderboards, used for caching. Don't call this often! */
async function fetchAllLeaderboards(fast?: boolean): Promise<void> {
	const leaderboards: string[] = await fetchAllMemberLeaderboardAttributes()

	if (debug) console.debug('Caching raw leaderboards!')

	for (const leaderboard of shuffle(leaderboards))
		await fetchMemberLeaderboardRaw(leaderboard)
	finishedCachingRawLeaderboards = true
}

export async function createSession(refreshToken: string, userData: discord.DiscordUser): Promise<string> {
	const sessionId = uuid4()
	await sessionsCollection?.insertOne({
		_id: sessionId,
		refresh_token: refreshToken,
		discord_user: {
			id: userData.id,
			name: userData.username + '#' + userData.discriminator
		},
		lastUpdated: new Date()
	})
	return sessionId
}

export async function fetchSession(sessionId: string): Promise<WithId<SessionSchema> | null> {
	return await sessionsCollection?.findOne({ _id: sessionId as any } )
}

export async function fetchAccount(minecraftUuid: string): Promise<WithId<AccountSchema> | null> {
	return await accountsCollection?.findOne({ minecraftUuid })
}

export async function fetchAccountFromDiscord(discordId: string): Promise<WithId<AccountSchema> | null> {
	return await accountsCollection?.findOne({ discordId })
}

export async function updateAccount(discordId: string, schema: AccountSchema) {
	await accountsCollection?.updateOne({
		discordId
	}, { $set: schema }, { upsert: true })
}

export async function fetchServerStatus() {
	return await database.admin().serverStatus()
}

// make sure it's not in a test
console.log('global.isTest', globalThis.isTest)
if (!globalThis.isTest) {
	connect().then(() => {
		// when it connects, cache the leaderboards and remove bad members
		removeBadMemberLeaderboardAttributes()
		// cache leaderboards on startup so its faster later on
		fetchAllLeaderboards(true)
		// cache leaderboard players again every 4 hours
		setInterval(fetchAllLeaderboards, 4 * 60 * 60 * 1000)
	})
}

