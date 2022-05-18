/**
 * Store data about members for leaderboards
*/

import { categorizeStat, getStatUnit } from './cleaners/skyblock/stats.js'
import { CleanFullProfile } from './cleaners/skyblock/profile.js'
import { SLAYER_TIERS } from './cleaners/skyblock/slayers.js'
import { Binary, Collection, Db, MongoClient, WithId } from 'mongodb'
import { CleanMember } from './cleaners/skyblock/member.js'
import * as cached from './hypixelCached.js'
import * as constants from './constants.js'
import { isUuid, letterFromColorCode, minecraftColorCodes, shuffle, sleep } from './util.js'
import * as discord from './discord.js'
import NodeCache from 'node-cache'
import { v4 as uuid4 } from 'uuid'
import { debug } from './index.js'
import Queue from 'queue-promise'
import { RANK_COLORS } from './cleaners/rank.js'
import { cleanItemId } from './cleaners/skyblock/itemId.js'
import { periodicallyFetchRecentlyEndedAuctions } from './hypixel.js'

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
	/** The color code of this player's rank */
	color: string
	username: string
	stats: Record<string, number>
	lastUpdated: Date
}
interface DatabaseProfileLeaderboardItem {
	uuid: string
	/** The color codes of the players ranks */
	colors: string[]
	/** An array of uuids for each player in the profile */
	players: string[]
	usernames: string[]
	stats: Record<string, number>
	lastUpdated: Date
}


interface memberRawLeaderboardItem {
	uuid: string
	profile: string
	color: string
	username: string
	value: number
}
interface profileRawLeaderboardItem {
	uuid: string
	/** An array of uuids for each player in the profile */
	players: string[]
	colors: string[]
	usernames: string[]
	value: number
}

interface MemberLeaderboardItem {
	player: LeaderboardBasicPlayer
	profileUuid: string
	value: number
}
interface ProfileLeaderboardItem {
	players: LeaderboardBasicPlayer[]
	profileUuid: string
	value: number
}

export const cachedRawLeaderboards: Map<string, (memberRawLeaderboardItem | profileRawLeaderboardItem)[]> = new Map()

const leaderboardMax = 100
const reversedLeaderboards = [
	'first_join', 'last_save',
	'_best_time', '_best_time_2',
	'fastest_coop_join'
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
	blurBackground?: boolean
	emoji?: string
}

export interface AccountSchema {
	_id?: string
	discordId: string
	minecraftUuid?: string
	customization?: AccountCustomization
}

export interface SimpleAuctionSchemaBson {
	/** The UUID of the auction so we can look it up later. */
	id: Binary
	coins: number
	/**
	 * The timestamp as **seconds** since epoch. It's in seconds instead of ms
	 * since we don't need to be super exact and so it's shorter.
	 */
	ts: number
	/** Whether the auction was successfully bought or simply expired. */
	s: boolean
	bin: boolean
}
export interface SimpleAuctionSchema {
	/** The UUID of the auction so we can look it up later. */
	id: string
	coins: number
	/**
	 * The timestamp as **seconds** since epoch. It's in seconds instead of ms
	 * since we don't need to be super exact and so it's shorter.
	 */
	ts: number
	/** Whether the auction was successfully bought or simply expired. */
	s: boolean
	bin: boolean
}
export interface ItemAuctionsSchema {
	/** The id of the item */
	id: string
	auctions: SimpleAuctionSchema[]
}
export interface ItemAuctionsSchemaBson {
	/** The id of the item */
	_id: string
	auctions: SimpleAuctionSchemaBson[]
}

let memberLeaderboardsCollection: Collection<DatabaseMemberLeaderboardItem>
let profileLeaderboardsCollection: Collection<DatabaseProfileLeaderboardItem>
let sessionsCollection: Collection<SessionSchema>
let accountsCollection: Collection<AccountSchema>
let itemAuctionsCollection: Collection<ItemAuctionsSchemaBson>


const leaderboardInfos: { [leaderboardName: string]: string } = {
	highest_crit_damage: 'This leaderboard is capped at the integer limit. Look at the <a href="/leaderboard/highest_critical_damage">highest critical damage leaderboard</a> instead.',
	highest_critical_damage: 'uhhhhh yeah idk either',
	leaderboards_count: 'This leaderboard counts how many leaderboards a player is in the top 100 spot for.',
	top_1_leaderboards_count: 'This leaderboard counts how many leaderboards a player is in the #1 spot for.',
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
	itemAuctionsCollection = database.collection('item-auctions')

	periodicallyFetchRecentlyEndedAuctions()

	console.log('Connected to database :)')
}

interface StringNumber {
	[name: string]: number
}

function createUuid(uuid: string): Binary {
	return new Binary(Buffer.from((uuid).replace(/-/g, ''), 'hex'), Binary.SUBTYPE_UUID)
}

function getMemberCollectionAttributes(member: CleanMember): StringNumber {
	const collectionAttributes = {}
	for (const collection of member.collections) {
		const collectionLeaderboardName = `collection_${collection.name}`
		collectionAttributes[collectionLeaderboardName] = collection.amount
	}
	return collectionAttributes
}

function getMemberSkillAttributes(member: CleanMember): StringNumber {
	if (!member.skills.apiEnabled) return {}
	const skillAttributes = {}
	for (const collection of member.skills.list) {
		const skillLeaderboardName = `skill_${collection.id}`
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
		slayerAttributes[`slayer_${slayer.rawName}_total_xp`] = slayer.xp
		slayerAttributes[`slayer_${slayer.rawName}_total_kills`] = slayer.kills
		for (const tier of slayer.tiers) {
			slayerAttributes[`slayer_${slayer.rawName}_${tier.tier}_kills`] = tier.kills
		}
	}

	return slayerAttributes
}

function getMemberHarpAttributes(member: CleanMember): StringNumber {
	const harpAttributes: StringNumber = {}

	for (const song of member.harp.songs) {
		harpAttributes[`harp_${song.id}_completions`] = song.completions
		harpAttributes[`harp_${song.id}_perfect_completions`] = song.perfectCompletions
	}

	return harpAttributes
}

function getFarmingContestAttributes(member: CleanMember): StringNumber {
	const farmingContestAttributes: StringNumber = {}

	let participated = 0
	let top1 = 0

	let participatedRecord: StringNumber = {}
	let top1Record: StringNumber = {}
	let highestScoreRecord: StringNumber = {}

	for (const contest of member.farmingContests.list) {
		participated++
		for (const cropContest of contest.crops) {
			if (participatedRecord[cropContest.item] === undefined)
				participatedRecord[cropContest.item] = 0
			participatedRecord[cropContest.item]++

			if (highestScoreRecord[cropContest.item] === undefined || highestScoreRecord[cropContest.item] < cropContest.amount)
				highestScoreRecord[cropContest.item] = cropContest.amount

			if (cropContest.position === 1) {
				top1++
				if (top1Record[cropContest.item] === undefined)
					top1Record[cropContest.item] = 0
				top1Record[cropContest.item]++
			}
		}
	}
	farmingContestAttributes['farming_contests_participated'] = participated
	farmingContestAttributes['farming_contests_top_1'] = top1

	for (const [cropName, value] of Object.entries(participatedRecord))
		farmingContestAttributes[`farming_contests_participated_${cropName}`] = value
	for (const [cropName, value] of Object.entries(top1Record))
		farmingContestAttributes[`farming_contests_top_1_${cropName}`] = value
	for (const [cropName, value] of Object.entries(highestScoreRecord))
		farmingContestAttributes[`farming_contests_highest_score_${cropName}`] = value

	return farmingContestAttributes
}

function getMemberLeaderboardAttributes(member: CleanMember): StringNumber {
	// if you want to add a new leaderboard for member attributes, add it here (and getAllLeaderboardAttributes)
	const data: StringNumber = {
		// we use the raw stat names rather than the clean stats in case hypixel adds a new stat and it takes a while for us to clean it
		...member.rawHypixelStats,

		// collection leaderboards
		...getMemberCollectionAttributes(member),

		// skill leaderboards
		...getMemberSkillAttributes(member),

		// slayer leaderboards
		...getMemberSlayerAttributes(member),

		// harp leaderboards
		...getMemberHarpAttributes(member),

		// farming contest leaderboards
		...getFarmingContestAttributes(member),

		fairy_souls: member.fairySouls.total,
		purse: member.purse,
		visited_zones: member.zones.filter(z => z.visited).length,
	}

	if (member.firstJoin)
		data.first_join = member.firstJoin
	if (member.lastSave)
		data.last_save = member.lastSave

	if (member.coopInvitation && member.coopInvitation.acceptedTimestamp && member.coopInvitation?.invitedBy?.uuid !== member.uuid) {
		data.fastest_coop_join = member.coopInvitation.acceptedTimestamp - member.coopInvitation.invitedTimestamp
		data.slowest_coop_join = member.coopInvitation.acceptedTimestamp - member.coopInvitation.invitedTimestamp
	}

	return data
}

function getProfileLeaderboardAttributes(profile: CleanFullProfile): StringNumber {
	// if you want to add a new leaderboard for member attributes, add it here (and getAllLeaderboardAttributes)
	return {
		unique_minions: profile.minionCount
	}
}


export async function fetchAllLeaderboardsCategorized(): Promise<{ [category: string]: string[] }> {
	const memberLeaderboardAttributes: string[] = await fetchAllMemberLeaderboardAttributes()
	const profileLeaderboardAttributes: string[] = await fetchAllProfileLeaderboardAttributes()

	const categorizedLeaderboards: { [category: string]: string[] } = {}
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
		for (let slayerTier = 1; slayerTier <= SLAYER_TIERS[slayerNameRaw]; slayerTier++) {
			leaderboardNames.push(`slayer_${slayerNameRaw}_${slayerTier}_kills`)
		}
	}

	return leaderboardNames
}

async function fetchHarpLeaderboards(): Promise<string[]> {
	const harpSongs = await constants.fetchHarpSongs()
	const leaderboardNames: string[] = []

	for (const songId of harpSongs) {
		leaderboardNames.push(`harp_${songId}_completions`)
		leaderboardNames.push(`harp_${songId}_perfect_completions`)
	}

	return leaderboardNames
}

async function fetchFarmingContestLeaderboards(): Promise<string[]> {
	const leaderboardNames: string[] = []

	leaderboardNames.push(`farming_contests_participated`)
	leaderboardNames.push(`farming_contests_top_1`)
	for (const crop of await constants.fetchCrops()) {
		leaderboardNames.push(`farming_contests_participated_${crop}`)
		leaderboardNames.push(`farming_contests_top_1_${crop}`)
		leaderboardNames.push(`farming_contests_highest_score_${crop}`)
	}

	return leaderboardNames
}

/** Fetch the names of all the leaderboards that rank members */
export async function fetchAllMemberLeaderboardAttributes(): Promise<string[]> {
	return [
		// we use the raw stat names rather than the clean stats in case hypixel adds a new stat and it takes a while for us to clean it
		...await constants.fetchStats(),

		// collection leaderboards
		...(await constants.fetchCollections()).map(value => `collection_${cleanItemId(value)}`),

		// skill leaderboards
		...(await constants.fetchSkills()).map(value => `skill_${value}`),

		// slayer leaderboards
		...await fetchSlayerLeaderboards(),

		// harp leaderboards
		...await fetchHarpLeaderboards(),

		// farming contest leaderboards
		...await fetchFarmingContestLeaderboards(),

		'fairy_souls',
		'first_join',
		'last_save',
		'purse',
		'visited_zones',
		'leaderboards_count',
		'top_1_leaderboards_count',
		'fastest_coop_join',
		'slowest_coop_join',
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
		let trailingStart = leaderboardMatch.slice(-1) === '_'
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
	if (fetchingRawLeaderboardNames.has(name) && !cachedRawLeaderboards.get(name)) {
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

	if (debug) console.debug(`Fetching leaderboard ${name} from database...`)
	try {
		const leaderboardRaw: memberRawLeaderboardItem[] = (await memberLeaderboardsCollection
			.find(query)
			.sort(sortQuery)
			.limit(leaderboardMax)
			.toArray())
			.map((i: DatabaseMemberLeaderboardItem): memberRawLeaderboardItem => {
				return {
					profile: i.profile,
					uuid: i.uuid,
					color: i.color,
					username: i.username,
					value: i.stats[name]
				}
			})
		fetchingRawLeaderboardNames.delete(name)
		cachedRawLeaderboards.set(name, leaderboardRaw)
		return leaderboardRaw
	} catch (e) {
		// if it fails while fetching, remove it from fetchingRawLeaderboardNames
		fetchingRawLeaderboardNames.delete(name)
		if (debug) console.debug(`Failed getting leaderboard ${name}!`)
		throw e
	}
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
	try {
		const leaderboardRaw: profileRawLeaderboardItem[] = (await profileLeaderboardsCollection
			.find(query)
			.sort(sortQuery)
			.limit(leaderboardMax)
			.toArray())
			.map((i: DatabaseProfileLeaderboardItem): profileRawLeaderboardItem => {
				return {
					players: i.players,
					colors: i.colors,
					usernames: i.usernames,
					uuid: i.uuid,
					value: i.stats[name]
				}
			})
		fetchingRawLeaderboardNames.delete(name)

		cachedRawLeaderboards.set(name, leaderboardRaw)
		return leaderboardRaw
	} catch (e) {
		// if it fails while fetching, remove it from fetchingRawLeaderboardNames
		fetchingRawLeaderboardNames.delete(name)
		throw e
	}
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

interface LeaderboardBasicPlayer {
	uuid: string
	username: string | undefined
	rank: {
		color: string
	}
}

/** Fetch a leaderboard that ranks members, as opposed to profiles */
export async function fetchMemberLeaderboard(name: string): Promise<MemberLeaderboard> {
	const leaderboardRaw = await fetchMemberLeaderboardRaw(name)


	const leaderboard: MemberLeaderboardItem[] = []
	for (const i of leaderboardRaw) {
		leaderboard.push({
			player: {
				uuid: i.uuid,
				username: i.username,
				rank: {
					color: (i.color ? minecraftColorCodes[i.color] : null) ?? minecraftColorCodes[RANK_COLORS.NONE]!,
				},
			},
			profileUuid: i.profile,
			value: i.value
		})
	}
	return {
		name: name,
		unit: getStatUnit(name) ?? null,
		list: leaderboard
	}
}


/** Fetch a leaderboard that ranks profiles, as opposed to members */
export async function fetchProfileLeaderboard(name: string): Promise<ProfileLeaderboard> {
	const leaderboardRaw = await fetchProfileLeaderboardRaw(name)

	const fetchLeaderboardProfile = async (i: profileRawLeaderboardItem): Promise<ProfileLeaderboardItem> => {
		const players: LeaderboardBasicPlayer[] = []
		for (const playerUuid of i.players) {
			const player: LeaderboardBasicPlayer = {
				uuid: playerUuid,
				username: i.usernames ? i.usernames[i.players.indexOf(playerUuid)] : undefined,
				rank: {
					color: i.colors ? i.colors[i.players.indexOf(playerUuid)] : minecraftColorCodes[RANK_COLORS.NONE]!
				}
			}
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
export async function fetchLeaderboard(name: string): Promise<MemberLeaderboard | ProfileLeaderboard> {
	const profileLeaderboards = await fetchAllProfileLeaderboardAttributes()
	let leaderboard: MemberLeaderboard | ProfileLeaderboard
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
export async function fetchMemberLeaderboardSpots(player: string, profile: string, lazy = false): Promise<LeaderboardSpot[] | null> {
	let playerUuid: string | undefined
	let profileUuid: string | undefined
	if (isUuid(player)) playerUuid = player
	if (isUuid(profile)) profileUuid = profile

	let fullProfile: CleanFullProfile
	let fullMember: CleanMember
	if (!(lazy && profileUuid)) {
		const fullProfileNullable = await cached.fetchProfile(player, profile)
		if (!fullProfileNullable) return null
		fullProfile = fullProfileNullable
		profileUuid = fullProfile.uuid

		if (!(lazy && playerUuid)) {
			const fullMemberNullable = fullProfile.members.find(m => m.username.toLowerCase() === player.toLowerCase() || m.uuid === player)
			if (!fullMemberNullable) return null
			fullMember = fullMemberNullable
			playerUuid = fullMember.uuid
		}
	}

	let applicableAttributes: StringNumber = {}
	if (!lazy) {
		// update the leaderboard positions for the member
		await updateDatabaseMember(fullMember!, fullProfile!)

		applicableAttributes = await getApplicableMemberLeaderboardAttributes(fullMember!)
	} else {
		const memberDoc = await memberLeaderboardsCollection.findOne({
			uuid: playerUuid,
			profile: profileUuid
		})
		applicableAttributes = memberDoc?.stats ?? {}
	}

	const memberLeaderboardSpots: LeaderboardSpot[] = []

	let leaderboardPromises: Promise<memberRawLeaderboardItem[]>[] = []
	for (const leaderboardName in applicableAttributes)
		leaderboardPromises.push(fetchMemberLeaderboardRaw(leaderboardName))
	for (const leaderboardName in applicableAttributes) {
		const leaderboard = await leaderboardPromises.shift()!
		const leaderboardPositionIndexByValue = leaderboard.findIndex(i => i.value === applicableAttributes[leaderboardName])
		const leaderboardPositionIndexByUser = leaderboard.findIndex(i => i.uuid === playerUuid && i.profile === profileUuid)
		const leaderboardPositionIndex = leaderboardPositionIndexByValue !== -1 ? leaderboardPositionIndexByValue : leaderboardPositionIndexByUser

		memberLeaderboardSpots.push({
			name: leaderboardName,
			positionIndex: leaderboardPositionIndex,
			value: applicableAttributes[leaderboardName],
			unit: getStatUnit(leaderboardName) ?? null
		})
	}

	memberLeaderboardSpots.sort((a, b) => a.positionIndex - b.positionIndex)

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

	for (const [leaderboard, attributeValue] of Object.entries(leaderboardAttributes)) {
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

	for (const [leaderboard, attributeValue] of Object.entries(leaderboardAttributes)) {
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

/**
 * Make sure there's no lingering profiles from when a player's profile was
 * deleted. This only makes one database call if there's no profiles to delete.
 */
export async function removeDeletedProfilesFromLeaderboards(memberUuid: string, profilesUuids: string[]) {
	if (!client) return

	const leaderboardProfilesInDatabase = (await (await memberLeaderboardsCollection.find({
		uuid: memberUuid,
	})).toArray())

	for (const leaderboardProfile of leaderboardProfilesInDatabase) {
		if (!profilesUuids.includes(leaderboardProfile.profile)) {
			await memberLeaderboardsCollection.deleteOne({
				uuid: memberUuid,
				profile: leaderboardProfile.profile
			})
			if (debug)
				console.log(`Profile ${leaderboardProfile.profile} (member ${memberUuid}) was deleted but was still in leaderboards database, removed.`)

			for (const leaderboardName in leaderboardProfile.stats)
				// we want to refresh the leaderboard so we just remove the cache
				cachedRawLeaderboards.delete(leaderboardName)
		}
	}
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
		constants.addStats(Object.keys(member.rawHypixelStats))

	if (debug) console.debug('done constants..')

	const leaderboardAttributes = member.left ? {} : await getApplicableMemberLeaderboardAttributes(member)

	if (debug) console.debug('done getApplicableMemberLeaderboardAttributes..', member.username, profile.name)

	if (Object.values(leaderboardAttributes).length > 0) {
		await memberLeaderboardsCollection.updateOne(
			{
				uuid: member.uuid,
				profile: profile.uuid
			},
			{
				'$set': {
					color: member.rank.color ? (letterFromColorCode(member.rank.color) ?? '') : '',
					username: member.username,
					stats: leaderboardAttributes,
					last_updated: new Date()
				}
			},
			{ upsert: true }
		)
	} else {
		// no leaderboard attributes, delete them!
		await memberLeaderboardsCollection.deleteOne({
			uuid: member.uuid,
			profile: profile.uuid
		})
	}

	for (const [attributeName, attributeValue] of Object.entries(leaderboardAttributes)) {
		const existingRawLeaderboard = await fetchMemberLeaderboardRaw(attributeName)
		const leaderboardReverse = isLeaderboardReversed(attributeName)

		const newRawLeaderboard = existingRawLeaderboard
			// remove the player from the leaderboard, if they're there
			.filter(value => value.uuid !== member.uuid || value.profile !== profile.uuid)
			.concat([{
				value: attributeValue,
				uuid: member.uuid,
				profile: profile.uuid,
				color: member.rank.color ? (letterFromColorCode(member.rank.color) ?? '') : '',
				username: member.username
			}])
			.sort((a, b) => leaderboardReverse ? a.value - b.value : b.value - a.value)
			.slice(0, 100)
		cachedRawLeaderboards.set(attributeName, newRawLeaderboard)
	}

	if (debug) console.debug('added member to leaderboards', leaderboardAttributes, member.username)
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

	if (leaderboardAttributes.length > 0) {
		await profileLeaderboardsCollection.updateOne(
			{
				uuid: profile.uuid
			},
			{
				'$set': {
					players: profile.members.map(p => p.uuid),
					colors: profile.members.map(p => p.rank.color ? (letterFromColorCode(p.rank.color) ?? '') : ''),
					usernames: profile.members.map(p => p.username),
					stats: leaderboardAttributes,
					last_updated: new Date()
				}
			},
			{ upsert: true }
		)

	} else {
		// no leaderboard attributes, delete them!
		await profileLeaderboardsCollection.deleteOne({
			uuid: profile.uuid,
			profile: profile.uuid
		})
	}


	// add the profile to the cached leaderboard without having to refetch it
	for (const [attributeName, attributeValue] of Object.entries(leaderboardAttributes)) {
		const existingRawLeaderboard = await fetchProfileLeaderboardRaw(attributeName)
		const leaderboardReverse = isLeaderboardReversed(attributeName)

		const newRawLeaderboard = existingRawLeaderboard
			// remove the player from the leaderboard, if they're there
			.filter(value => value.uuid !== profile.uuid)
			.concat([{
				value: attributeValue,
				uuid: profile.uuid,
				players: profile.members.map(p => p.uuid),
				colors: profile.members.map(p => p.rank.color ? (letterFromColorCode(p.rank.color) ?? '') : ''),
				usernames: profile.members.map(p => p.username),
			}])
			.sort((a, b) => leaderboardReverse ? a.value - b.value : b.value - a.value)
			.slice(0, 100)
		cachedRawLeaderboards.set(attributeName, newRawLeaderboard)
	}

	if (debug) console.debug('added profile to leaderboards', profile.name, leaderboardAttributes)
}

export const leaderboardUpdateMemberQueue = new Queue({
	concurrent: 2,
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
	leaderboardUpdateMemberQueue.enqueue(async () => await updateDatabaseMember(member, profile))
}

/** Queue an update for the profile's leaderboard data on the server if applicable */
export function queueUpdateDatabaseProfile(profile: CleanFullProfile): void {
	if (recentlyQueued.get(profile.uuid + 'profile')) return
	else recentlyQueued.set(profile.uuid + 'profile', true)
	leaderboardUpdateProfileQueue.enqueue(async () => await updateDatabaseProfile(profile))
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

	if (debug)
		console.log('Deleted profiles that have no stats from leaderboards')
	await memberLeaderboardsCollection.deleteMany({ stats: {} })
	await profileLeaderboardsCollection.deleteMany({ stats: {} })
	if (debug)
		console.log('Finished deleted profiles that have no stats from leaderboards')
}

export let finishedCachingRawLeaderboards = false

/** Fetch all the leaderboards, used for caching. Don't call this often! */
async function fetchAllLeaderboards(): Promise<void> {
	const leaderboards: string[] = await fetchAllMemberLeaderboardAttributes()

	if (debug) console.debug('Caching raw leaderboards!')

	let concurrentlyFetching = 0

	for (const leaderboard of shuffle(leaderboards)) {
		let fetchLeaderboardPromise = fetchMemberLeaderboardRaw(leaderboard)
		concurrentlyFetching++
		if (concurrentlyFetching > 10) {
			await fetchLeaderboardPromise
			concurrentlyFetching--
		} else
			fetchLeaderboardPromise.then(() => concurrentlyFetching--)
	}
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
	return await sessionsCollection?.findOne({ _id: sessionId as any })
}


export async function deleteSession(sessionId: string) {
	return await sessionsCollection?.deleteOne({ _id: sessionId as any })
}

export async function fetchAccount(minecraftUuid: string): Promise<WithId<AccountSchema> | null> {
	return await accountsCollection?.findOne({ minecraftUuid })
}

export async function fetchAccountFromDiscord(discordId: string): Promise<WithId<AccountSchema> | null> {
	return await accountsCollection?.findOne({ discordId })
}

export async function updateAccount(discordId: string, schema: AccountSchema) {
	if (schema.minecraftUuid) {
		const existingAccount = await accountsCollection?.findOne({ minecraftUuid: schema.minecraftUuid })
		// if the discord ids don't match, change the discord id of the existing account
		if (existingAccount && existingAccount.discordId !== discordId) {
			await accountsCollection?.updateOne(
				{ minecraftUuid: schema.minecraftUuid },
				{ '$set': { discordId } }
			)
		}
	}
	await accountsCollection?.updateOne({
		discordId
	}, { $set: schema }, { upsert: true })
}

function toItemAuctionsSchema(i: ItemAuctionsSchemaBson) {
	return {
		id: i._id,
		auctions: i.auctions.map(a => {
			return {
				...a,
				id: a.id.toString('hex'),
			}
		}),
	}
}

function toItemAuctionsSchemaBson(i: ItemAuctionsSchema) {
	return {
		_id: i.id,
		auctions: i.auctions.map(a => {
			return {
				...a,
				id: createUuid(a.id)
			}
		}),
	}
}

/** Fetch all the Item Auctions for the item ids in the given array. */
export async function fetchItemsAuctions(itemIds: string[]): Promise<ItemAuctionsSchema[]> {
	const auctions = await itemAuctionsCollection?.find({
		_id: { $in: itemIds }
	}).toArray()
	return auctions.map(toItemAuctionsSchema)
}


/** Fetch all the Item Auctions for the item ids in the given array. */
export async function fetchPaginatedItemsAuctions(skip: number, limit: number): Promise<ItemAuctionsSchema[]> {
	const auctions = await itemAuctionsCollection?.find({}).skip(skip).limit(limit).toArray()
	return auctions.map(toItemAuctionsSchema)
}

export async function updateItemAuction(auction: ItemAuctionsSchema) {
	await itemAuctionsCollection?.updateOne({
		_id: auction.id,
	}, { $set: toItemAuctionsSchemaBson(auction) }, { upsert: true })
}

/**
 * Fetches the SkyBlock ids of all the items in the auctions database. This method is slow and should be cached!
 */
export async function fetchItemsAuctionsIds(): Promise<string[] | undefined> {
	if (!itemAuctionsCollection) return undefined
	const docs = await itemAuctionsCollection?.aggregate([
		// this removes everything except the _id
		{ $project: { _id: true } }
	]).toArray()
	return docs.map(r => r._id)
}


export async function fetchServerStatus() {
	return await database.admin().serverStatus()
}

export async function fetchServerStats() {
	return await database.stats()
}

// make sure it's not in a test
console.log('global.isTest', globalThis.isTest)
if (!globalThis.isTest) {
	connect().then(() => {
		// when it connects, cache the leaderboards and remove bad members
		removeBadMemberLeaderboardAttributes()
		// cache leaderboards on startup so its faster later on
		fetchAllLeaderboards()
		// cache leaderboard players again every 4 hours
		setInterval(fetchAllLeaderboards, 4 * 60 * 60 * 1000)
	})
}

