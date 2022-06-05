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
	fetchItemsAuctions,
	fetchItemsAuctionsIds,
	ItemAuctionsSchema,
	queueUpdateDatabaseMember,
	queueUpdateDatabaseProfile,
	removeDeletedProfilesFromLeaderboards,
	SimpleAuctionSchema,
	updateItemAuction
} from './database.js'
import { cleanElectionResponse, ElectionData } from './cleaners/skyblock/election.js'
import { cleanItemListResponse, ItemListData } from './cleaners/skyblock/itemList.js'
import { CleanBasicMember, CleanMemberProfile } from './cleaners/skyblock/member.js'
import { cleanSkyblockProfilesResponse } from './cleaners/skyblock/profiles.js'
import { CleanPlayer, cleanPlayerResponse } from './cleaners/player.js'
import { chooseApiKey, sendApiRequest } from './hypixelApi.js'
import typedHypixelApi from 'typed-hypixel-api'
import * as cached from './hypixelCached.js'
import { debug } from './index.js'
import { WithId } from 'mongodb'
import { cleanEndedAuctions } from './cleaners/skyblock/endedAuctions.js'
import { cleanAuctions } from './cleaners/skyblock/auctions.js'
import { string } from 'prismarine-nbt'
import { withCache } from './util.js'
import { Item } from './cleaners/skyblock/inventory.js'
import { cleanBazaar } from './cleaners/skyblock/bazaar.js'

export type Included = 'profiles' | 'player' | 'stats' | 'inventories' | undefined

// the interval at which the "last_save" parameter updates in the hypixel api, this is 3 minutes
export const saveInterval = 60 * 3 * 1000

/**
 *  Send a request to api.hypixel.net using a random key, clean it up to be more useable, and return it 
 */

export interface ApiOptions {
	mainMemberUuid?: string
	/** Only get the most basic information, like uuids and names */
	basic?: boolean
}

/** Sends an API request to Hypixel and returns the response. */
export async function sendUncleanApiRequest<P extends keyof typedHypixelApi.Requests>(path: P, args: Omit<typedHypixelApi.Requests[P]['options'], 'key'>): Promise<typedHypixelApi.Requests[P]['response']['data']> {
	const key = await chooseApiKey()
	const data = await sendApiRequest(path, { key, ...args })
	if (!data)
		throw new Error(`No data returned from ${path}`)
	return data
}

/** Sends an API request to Hypixel and cleans it up. */
export async function sendCleanApiRequest<P extends keyof typeof cleanResponseFunctions>(path: P, args: Omit<typedHypixelApi.Requests[P]['options'], 'key'>, options?: ApiOptions): Promise<Awaited<ReturnType<typeof cleanResponseFunctions[P]>>> {
	const data = await sendUncleanApiRequest(path, args)
	return await cleanResponse(path, data, options ?? {})
}

const cleanResponseFunctions = {
	'player': (data, options) => cleanPlayerResponse(data.player),
	'skyblock/profile': (data: typedHypixelApi.SkyBlockProfileResponse, options) => cleanSkyblockProfileResponse(data.profile, options),
	'skyblock/profiles': (data, options) => cleanSkyblockProfilesResponse(data.profiles),
	'skyblock/auctions_ended': (data, options) => cleanEndedAuctions(data),
	'skyblock/auction': (data, options) => cleanAuctions(data),
	'skyblock/bazaar': (data, options) => cleanBazaar(data),
	'resources/skyblock/election': (data, options) => cleanElectionResponse(data),
	'resources/skyblock/items': (data, options) => cleanItemListResponse(data),
} as const


async function cleanResponse<P extends keyof typeof cleanResponseFunctions>(
	path: P,
	data: typedHypixelApi.Requests[P]['response']['data'],
	options: ApiOptions
): Promise<Awaited<ReturnType<typeof cleanResponseFunctions[P]>>> {
	// Cleans up an api response
	const cleaningFunction: typeof cleanResponseFunctions[P] = cleanResponseFunctions[path]
	// we do `as any` because typescript unfortunately doesn't know which path it is
	const cleanedData = await cleaningFunction(data as any, options)
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
	profiles?: CleanProfile[] | CleanBasicProfile[]
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
		playerData = await cached.fetchPlayer(uuid, true)
		// if not including profiles, include lightweight profiles just in case
		if (!includeProfiles)
			basicProfilesData = playerData?.profiles
		// we don't want the `profiles` field in `player`
		if (playerData)
			delete playerData.profiles
	}
	if (includeProfiles)
		profilesData = await cached.fetchSkyblockProfiles(uuid) ?? []

	let activeProfile: CleanProfile
	let lastOnline: number = 0

	if (includeProfiles && profilesData !== undefined) {
		for (const profile of profilesData) {
			const member = profile.members?.find(member => member.uuid === uuid)
			if (member && member.lastSave && member.lastSave > lastOnline) {
				lastOnline = member.lastSave
				activeProfile = profile
			}
		}

		// we don't await so it happens in the background
		removeDeletedProfilesFromLeaderboards(uuid, profilesData.map(p => p.uuid))
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

	const player: CleanPlayer | null = await cached.fetchPlayer(playerUuid, true)

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
			rank: m.rank,
			left: m.left
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


export async function fetchMemberProfilesUncached(playerUuid: string): Promise<CleanFullProfile[] | null> {
	const profiles = await sendCleanApiRequest(
		'skyblock/profiles',
		{ uuid: playerUuid },
		{
			// only the inventories for the main player are generated, this is for optimization purposes
			mainMemberUuid: playerUuid
		}
	)
	if (profiles === null)
		return null
	for (const profile of profiles) {
		for (const member of profile.members) {
			queueUpdateDatabaseMember(member, profile)
		}
		queueUpdateDatabaseProfile(profile)
	}
	return profiles
}

export async function fetchElection(): Promise<ElectionData> {
	return await withCache(
		'election',
		(r) => new Date((r.lastUpdated + 60 * 60) * 1000),
		async () => {
			return await sendCleanApiRequest(
				'resources/skyblock/election',
				{}
			)
		}
	)
}


export async function fetchItemList() {
	return await withCache(
		'itemList',
		(r) => new Date((r.lastUpdated + 60 * 60) * 1000),
		async () => {
			return await sendCleanApiRequest(
				'resources/skyblock/items',
				{}
			)
		}
	)
}

export async function fetchAuctionUncached(uuid: string) {
	return await sendCleanApiRequest(
		'skyblock/auction',
		{ uuid }
	)
}

/**
 * Create an id that we use to differenciate between different items that are sold in auctions. This can also be used to filter out specific items by returning undefined.
 */
function createAuctionItemId(item: Item): string | undefined {
	if (item.id === 'PET' && item.petInfo?.id)
		return `${item.petInfo.id}_${item.id}`
	if (item.id === 'ENCHANTED_BOOK') {
		if (Object.keys(item.enchantments ?? {}).length !== 1)
			// we only care about enchanted books that have a single enchantment
			return
		const [[enchantName, enchantValue]] = Object.entries(item.enchantments ?? {})
		return `${item.id}_${enchantName.toUpperCase()}_${enchantValue}`
	}
	return item.id
}

// this function is called from database.ts so it starts when we connect to the database
// it should only ever be called once!
export async function periodicallyFetchRecentlyEndedAuctions() {
	let previousAuctionIds = new Set()

	while (true) {
		const endedAuctions = await sendCleanApiRequest(
			'skyblock/auctions_ended',
			{}
		)


		let newAuctionUuids: Set<string> = new Set()
		let newAuctionItemIds: Set<string> = new Set()

		for (const auction of endedAuctions.auctions) {
			if (previousAuctionIds.has(auction.id)) continue
			const auctionItemId = createAuctionItemId(auction.item)
			if (!auctionItemId) continue

			newAuctionUuids.add(auction.id)
			newAuctionItemIds.add(auctionItemId)
		}
		let updatedDatabaseAuctionItems: Map<string, ItemAuctionsSchema> = new Map()

		const itemsAuctions = await fetchItemsAuctions(Array.from(newAuctionItemIds))
		for (const itemAuctions of itemsAuctions) {
			updatedDatabaseAuctionItems.set(itemAuctions.id, itemAuctions)
		}

		for (const auction of endedAuctions.auctions) {
			if (previousAuctionIds.has(auction.id)) continue

			const auctionItemId = createAuctionItemId(auction.item)
			if (!auctionItemId) continue

			let auctions: SimpleAuctionSchema[]
			if (!updatedDatabaseAuctionItems.has(auctionItemId)) {
				auctions = []
			} else {
				auctions = updatedDatabaseAuctionItems.get(auctionItemId)!.auctions
			}

			const simpleAuction: SimpleAuctionSchema = {
				s: true,
				coins: Math.round(auction.coins / (auction.item.count ?? 1)),
				id: auction.id,
				ts: Math.floor(auction.timestamp / 1000),
				bin: auction.bin,
			}
			// make sure the auction isn't already in there
			if (!auctions.find((a) => a.id === simpleAuction.id)) {
				auctions.push(simpleAuction)
				// keep only the last 100 items
				if (auctions.length > 100)
					auctions = auctions.slice(-100)
			}

			updatedDatabaseAuctionItems.set(auctionItemId, {
				id: auctionItemId,
				sbId: auction.item.id,
				auctions,
			})
		}

		// we use a promise pool to set all the things fast but not overload the database
		let tasks = Array.from(updatedDatabaseAuctionItems.values()).map(t => updateItemAuction(t))
		async function doTasks() {
			let hasTask = true
			while (hasTask) {
				const task = tasks.pop()
				if (task) {
					await task
				} else
					hasTask = false
			}
		}
		// Promise.all 5 cycles
		await Promise.all(Array(5).fill(0).map(_ => doTasks()))

		previousAuctionIds = newAuctionUuids

		let endedAgo = Date.now() - endedAuctions.lastUpdated
		// +10 seconds just so we're sure we'll get the update
		let refetchIn = 60 * 1000 - endedAgo + 10000

		await new Promise(resolve => setTimeout(resolve, refetchIn))
	}
}

export async function fetchAuctionItemsUncached() {
	const auctionItemIds = await fetchItemsAuctionsIds(true)
	if (!auctionItemIds) return undefined
	const itemList = await fetchItemList()
	const idsToData: Record<string, {
		display: { name: string }
		vanillaId?: string
		headTexture?: string
	}> = {}
	for (const item of itemList.list)
		// we only return items in auctionItemIds so the response isn't too big,
		// since usually it would contain stuff that we don't care about like
		// minions
		if (auctionItemIds.includes(item.id))
			idsToData[item.id] = {
				display: {
					name: item.display.name
				},
				vanillaId: item.vanillaId,
				headTexture: item.headTexture
			}
	// if the item in the database isn't in the items api, just set the name to the id
	for (const item of auctionItemIds)
		if (!(item in idsToData))
			idsToData[item] = {
				display: {
					name: (item.toLowerCase().replace(/^./, item[0].toUpperCase()).replace(/_/g, ' ')).replace(
						/\w\S*/g,
						w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
					)
				}
			}
	return idsToData
}

