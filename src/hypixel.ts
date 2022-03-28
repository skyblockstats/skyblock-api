/**
 * Fetch the clean Hypixel API
 */

import {
	cleanSkyblockProfileResponse,
	CleanProfile,
	CleanBasicProfile,
	CleanFullProfile,
	CleanFullProfileBasicMembers
} from './cleaners/skyblock/profile.js'
import {
	AccountCustomization,
	AccountSchema,
	fetchAccount,
	queueUpdateDatabaseMember,
	queueUpdateDatabaseProfile
} from './database.js'
import { cleanElectionResponse, ElectionData } from './cleaners/skyblock/election.js'
import { CleanBasicMember, CleanMemberProfile } from './cleaners/skyblock/member.js'
import { cleanSkyblockProfilesResponse } from './cleaners/skyblock/profiles.js'
import { CleanPlayer, cleanPlayerResponse } from './cleaners/player.js'
import { chooseApiKey, sendApiRequest } from './hypixelApi.js'
import typedHypixelApi from 'typed-hypixel-api'
import * as cached from './hypixelCached.js'
import { debug } from './index.js'
import { WithId } from 'mongodb'
import { cleanItemListResponse, ItemListData } from './cleaners/skyblock/itemList.js'

export type Included = 'profiles' | 'player' | 'stats' | 'inventories' | undefined

// the interval at which the "last_save" parameter updates in the hypixel api, this is 3 minutes
export const saveInterval = 60 * 3 * 1000

// the highest level a minion can be
export const maxMinion = 11

/**
 *  Send a request to api.hypixel.net using a random key, clean it up to be more useable, and return it 
 */

export interface ApiOptions {
	mainMemberUuid?: string
	/** Only get the most basic information, like uuids and names */
	basic?: boolean
}

/** Sends an API request to Hypixel and cleans it up. */
export async function sendCleanApiRequest<P extends keyof typeof cleanResponseFunctions>(path: P, args: Omit<typedHypixelApi.Requests[P]['options'], 'key'>, options?: ApiOptions): Promise<Awaited<ReturnType<typeof cleanResponseFunctions[P]>>> {
	const key = await chooseApiKey()
	const data = await sendApiRequest(path, { key, ...args })
	// clean the response
	return await cleanResponse(path, data, options ?? {})
}

const cleanResponseFunctions = {
	'player': (data, options) => cleanPlayerResponse(data.player),
	'skyblock/profile': (data: typedHypixelApi.SkyBlockProfileResponse, options) => cleanSkyblockProfileResponse(data.profile, options),
	'skyblock/profiles': (data, options) => cleanSkyblockProfilesResponse(data.profiles),
	'resources/skyblock/election': (data, options) => cleanElectionResponse(data),
	'resources/skyblock/items': (data, options) => cleanItemListResponse(data)
} as const


async function cleanResponse<P extends keyof typeof cleanResponseFunctions>(
	path: P,
	data: typedHypixelApi.Requests[P]['response'],
	options: ApiOptions
): Promise<Awaited<ReturnType<typeof cleanResponseFunctions[P]>>> {
	// Cleans up an api response
	const cleaningFunction: typeof cleanResponseFunctions[P] = cleanResponseFunctions[path]
	// we do `as any` because typescript unfortunately doesn't know which path it is
	const cleanedData = await cleaningFunction(data.data as any, options)
	return cleanedData as Awaited<ReturnType<typeof cleanResponseFunctions[P]>>
}


/* ----------------------------- */

export interface UserAny {
	user?: string
	uuid?: string
	username?: string
}

export interface CleanUser {
	player: CleanPlayer | null
	profiles?: CleanProfile[]
	activeProfile?: string
	online?: boolean
	customization?: AccountCustomization
}


/**
 * Higher level function that requests the api for a user, and returns the
 * cleaned response. This is used by the /player/<name> route.
 * This is safe to fetch many times because the results are cached!
 * @param included lets you choose what is returned, so there's less processing required on the backend.
 * used inclusions: player, profiles
 */
export async function fetchUser({ user, uuid, username }: UserAny, included: Included[] = ['player'], customization?: boolean): Promise<CleanUser | null> {
	if (!uuid) {
		// If the uuid isn't provided, get it
		if (!username && !user) return null
		uuid = await cached.uuidFromUser((user ?? username)!)
	}
	if (!uuid) {
		// the user doesn't exist.
		if (debug) console.debug('error:', user, 'doesnt exist')
		return null
	}
	const websiteAccountPromise = customization ? fetchAccount(uuid) : null

	const includePlayers = included.includes('player')
	const includeProfiles = included.includes('profiles')

	let profilesData: CleanProfile[] | undefined
	let basicProfilesData: CleanBasicProfile[] | undefined
	let playerData: CleanPlayer | null = null

	if (includePlayers) {
		playerData = await cached.fetchPlayer(uuid)
		// if not including profiles, include lightweight profiles just in case
		if (!includeProfiles)
			basicProfilesData = playerData?.profiles
		// we don't want the `profiles` field in `player`
		if (playerData)
			delete playerData.profiles
	}
	if (includeProfiles)
		profilesData = await cached.fetchSkyblockProfiles(uuid)

	let activeProfile: CleanProfile
	let lastOnline: number = 0

	if (includeProfiles) {
		for (const profile of profilesData!) {
			const member = profile.members?.find(member => member.uuid === uuid)
			if (member && member.lastSave && member.lastSave > lastOnline) {
				lastOnline = member.lastSave
				activeProfile = profile
			}
		}
	}
	let websiteAccount: WithId<AccountSchema> | null = null

	if (websiteAccountPromise)
		websiteAccount = await websiteAccountPromise

	return {
		player: playerData,
		profiles: profilesData ?? basicProfilesData,
		activeProfile: includeProfiles ? activeProfile!?.uuid : undefined,
		online: includeProfiles ? lastOnline > (Date.now() - saveInterval) : undefined,
		customization: websiteAccount?.customization
	}
}

/**
 * Fetch a CleanMemberProfile from a user and string
 * This is safe to use many times as the results are cached!
 * @param user A username or uuid
 * @param profile A profile name or profile uuid
 * @param customization Whether stuff like the user's custom background will be returned
 */
export async function fetchMemberProfile(user: string, profile: string, customization: boolean): Promise<CleanMemberProfile | null> {
	const playerUuid = await cached.uuidFromUser(user)
	if (!playerUuid) return null
	// we don't await the promise immediately so it can load while we do other stuff
	const websiteAccountPromise = customization ? fetchAccount(playerUuid) : null
	const profileUuid = await cached.fetchProfileUuid(user, profile)

	// if the profile or player doesn't have an id, just return
	if (!profileUuid) return null
	if (!playerUuid) return null

	const player: CleanPlayer | null = await cached.fetchPlayer(playerUuid)

	if (!player) return null // this should never happen, but if it does just return null

	const cleanProfile = await cached.fetchProfile(playerUuid, profileUuid)
	if (!cleanProfile) return null

	const member = cleanProfile.members.find(m => m.uuid === playerUuid)
	if (!member) return null // this should never happen, but if it does just return null

	// remove unnecessary member data
	const simpleMembers: CleanBasicMember[] = cleanProfile.members.map(m => {
		return {
			uuid: m.uuid,
			username: m.username,
			firstJoin: m.firstJoin,
			lastSave: m.lastSave,
			rank: m.rank
		}
	})

	const cleanProfileBasicMembers: CleanFullProfileBasicMembers = {
		...cleanProfile,
		members: simpleMembers
	}

	let websiteAccount: WithId<AccountSchema> | null = null

	if (websiteAccountPromise)
		websiteAccount = await websiteAccountPromise

	return {
		member: {
			// the profile name is in member rather than profile since they sometimes differ for each member
			profileName: cleanProfile.name!,
			// add all the member data
			...member,
			// add all other data relating to the hypixel player, such as username, rank, etc
			...player
		},
		profile: cleanProfileBasicMembers,
		customization: websiteAccount?.customization
	}
}

/**
 * Fetches the Hypixel API to get a CleanFullProfile. This doesn't do any caching and you should use hypixelCached.fetchProfile instead
 * @param playerUuid The UUID of the Minecraft player
 * @param profileUuid The UUID of the Hypixel SkyBlock profile
 */
export async function fetchMemberProfileUncached(playerUuid: string, profileUuid: string): Promise<null | CleanFullProfile> {
	const profile = await sendCleanApiRequest(
		'skyblock/profile',
		{ profile: profileUuid },
		{ mainMemberUuid: playerUuid }
	)

	// we check for minions in profile to filter out the CleanProfile type (as opposed to CleanFullProfile)
	if (!profile || !('minions' in profile)) return null

	// queue updating the leaderboard positions for the member, eventually
	if (profile.members)
		for (const member of profile.members)
			queueUpdateDatabaseMember(member, profile)
	queueUpdateDatabaseProfile(profile)

	return profile
}

/**
 * Fetches the Hypixel API to get a CleanProfile from its id. This doesn't do any caching and you should use hypixelCached.fetchBasicProfileFromUuid instead
 * @param playerUuid The UUID of the Minecraft player
 * @param profileUuid The UUID of the Hypixel SkyBlock profile
 */
export async function fetchBasicProfileFromUuidUncached(profileUuid: string): Promise<CleanProfile | null> {
	const profile = await sendCleanApiRequest(
		'skyblock/profile',
		{ profile: profileUuid },
		{ basic: true }
	)

	return profile
}


export async function fetchMemberProfilesUncached(playerUuid: string): Promise<CleanFullProfile[]> {
	const profiles: CleanFullProfile[] = await sendCleanApiRequest(
		'skyblock/profiles',
		{ uuid: playerUuid },
		{
			// only the inventories for the main player are generated, this is for optimization purposes
			mainMemberUuid: playerUuid
		}
	)
	for (const profile of profiles) {
		for (const member of profile.members) {
			queueUpdateDatabaseMember(member, profile)
		}
		queueUpdateDatabaseProfile(profile)
	}
	return profiles
}

let isFetchingElection = false
let cachedElectionData: ElectionData | null = null
let nextElectionUpdate: Date = new Date(0)

export async function fetchElection(): Promise<ElectionData> {
	if (cachedElectionData && nextElectionUpdate > new Date())
		return cachedElectionData

	// if it's currently fetching the election data and it doesn't have it,
	// wait until we do have the election data
	if (isFetchingElection && !cachedElectionData) {
		await new Promise(resolve => {
			const interval = setInterval(() => {
				if (cachedElectionData) {
					clearInterval(interval)
					resolve(cachedElectionData)
				}
			}, 100)
		})
	}

	isFetchingElection = true
	const election: ElectionData = await sendCleanApiRequest(
		'resources/skyblock/election',
		{}
	)
	isFetchingElection = false

	cachedElectionData = election
	// updates every 10 minutes
	nextElectionUpdate = new Date((election.lastUpdated + 10 * 60) * 1000)
	return election
}


let isFetchingItemList = false
let cachedItemListData: ItemListData | null = null
let nextItemListUpdate: Date = new Date(0)

export async function fetchItemList() {
	if (cachedItemListData && nextItemListUpdate > new Date())
		return cachedItemListData

	// if it's currently fetching the election data and it doesn't have it,
	// wait until we do have the election data
	if (isFetchingItemList && !cachedItemListData) {
		await new Promise(resolve => {
			const interval = setInterval(() => {
				if (cachedItemListData) {
					clearInterval(interval)
					resolve(cachedItemListData)
				}
			}, 100)
		})
	}

	isFetchingItemList = true
	const itemList: ItemListData = await sendCleanApiRequest(
		'resources/skyblock/items',
		{}
	)
	isFetchingItemList = false

	cachedItemListData = itemList
	// updates every 60 minutes
	nextElectionUpdate = new Date((itemList.lastUpdated + 60 * 60) * 1000)
	return itemList
}

