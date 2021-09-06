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
import { Auction, AuctionsResponse, cleanSkyBlockAuctionsResponse } from './cleaners/skyblock/auctions.js'
import { CleanBasicMember, CleanMemberProfile } from './cleaners/skyblock/member.js'
import { chooseApiKey, HypixelResponse, sendApiRequest } from './hypixelApi.js'
import { cleanSkyblockProfilesResponse } from './cleaners/skyblock/profiles.js'
import { CleanPlayer, cleanPlayerResponse } from './cleaners/player.js'
import { Item } from './cleaners/skyblock/inventory.js'
import * as cached from './hypixelCached.js'
import { debug } from './index.js'

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
export async function sendCleanApiRequest({ path, args }, included?: Included[], options?: ApiOptions): Promise<any> {
	const key = await chooseApiKey()
	const rawResponse = await sendApiRequest({ path, key, args })
	if (rawResponse.throttled) {
		// if it's throttled, wait a second and try again
		await new Promise(resolve => setTimeout(resolve, 1000))
		return await sendCleanApiRequest({ path, args }, included, options)
	}
	// clean the response
	return await cleanResponse({ path, data: rawResponse }, options ?? {})
}



async function cleanResponse({ path, data }: { path: string, data: HypixelResponse }, options: ApiOptions): Promise<any> {
	// Cleans up an api response
	switch (path) {
		case 'player': return await cleanPlayerResponse(data.player)
		case 'skyblock/profile': return await cleanSkyblockProfileResponse(data.profile, options)
		case 'skyblock/profiles': return await cleanSkyblockProfilesResponse(data.profiles)
		case 'skyblock/auctions': return await cleanSkyBlockAuctionsResponse(data)
		case 'skyblock/auctions_ended': return await cleanSkyBlockAuctionsResponse(data)
	}
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
 * Higher level function that requests the api for a user, and returns the cleaned response
 * This is safe to fetch many times because the results are cached!
 * @param included lets you choose what is returned, so there's less processing required on the backend
 * used inclusions: player, profiles
 */
export async function fetchUser({ user, uuid, username }: UserAny, included: Included[]=['player'], customization?: boolean): Promise<CleanUser | null> {
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
			if (member && member.last_save > lastOnline) {
				lastOnline = member.last_save
				activeProfile = profile
			}
		}
	}
	let websiteAccount: AccountSchema | null = null

	if (websiteAccountPromise)
		websiteAccount = await websiteAccountPromise

	return {
		player: playerData,
		profiles: profilesData ?? basicProfilesData,
		activeProfile: includeProfiles ? activeProfile!?.uuid : undefined,
		online: includeProfiles ? lastOnline > (Date.now() - saveInterval): undefined,
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

	const player = await cached.fetchPlayer(playerUuid)

	if (!player) return null // this should never happen, but if it does just return null

	const cleanProfile = await cached.fetchProfile(playerUuid, profileUuid) as CleanFullProfileBasicMembers

	const member = cleanProfile.members.find(m => m.uuid === playerUuid)
	if (!member) return null // this should never happen, but if it does just return null

	// remove unnecessary member data
	const simpleMembers: CleanBasicMember[] = cleanProfile.members.map(m => {
		return {
			uuid: m.uuid,
			username: m.username,
			first_join: m.first_join,
			last_save: m.last_save,
			rank: m.rank
		}
	})

	cleanProfile.members = simpleMembers

	let websiteAccount: AccountSchema | null = null

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
		profile: cleanProfile,
		customization: websiteAccount?.customization
	}
}

/**
 * Fetches the Hypixel API to get a CleanFullProfile. This doesn't do any caching and you should use hypixelCached.fetchProfile instead
 * @param playerUuid The UUID of the Minecraft player
 * @param profileUuid The UUID of the Hypixel SkyBlock profile
 */
 export async function fetchMemberProfileUncached(playerUuid: string, profileUuid: string): Promise<CleanFullProfile> {
	const profile: CleanFullProfile = await sendCleanApiRequest(
		{
			path: 'skyblock/profile',
			args: { profile: profileUuid }
		},
		undefined,
		{ mainMemberUuid: playerUuid }
	)

	// queue updating the leaderboard positions for the member, eventually
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
 export async function fetchBasicProfileFromUuidUncached(profileUuid: string): Promise<CleanProfile> {
	const profile: CleanFullProfile = await sendCleanApiRequest(
		{
			path: 'skyblock/profile',
			args: { profile: profileUuid }
		},
		undefined,
		{ basic: true }
	)

	return profile
}


export async function fetchMemberProfilesUncached(playerUuid: string): Promise<CleanFullProfile[]> {
	const profiles: CleanFullProfile[] = await sendCleanApiRequest({
		path: 'skyblock/profiles',
		args: {
			uuid: playerUuid
		}},
		undefined,
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

async function fetchAuctionsPage(page: number): Promise<AuctionsResponse> {
	return await sendCleanApiRequest({
		path: 'skyblock/auctions',
		args: {
			page: page
		}}
	)
}

/**
 * this is expensive and takes about a few seconds, use cached.fetchAllAuctions instead
 */
 export async function fetchAllAuctionsUncached(): Promise<AuctionsResponse> {
	const firstPage = await fetchAuctionsPage(1)
	console.log(`gotten first auctions page, there\'s a total of ${firstPage.pageCount} pages`)
	const allAuctions: Auction[] = [ ...firstPage.auctions ]

	const promises: Promise<AuctionsResponse>[] = []

	// for (let pageNumber = 2; pageNumber <= firstPage.pageCount; pageNumber ++)
	// 	promises.push(fetchAuctionsPage(pageNumber))
	promises.push(fetchAuctionsPage(2))

	const otherResponses = await Promise.all(promises)
	console.log('promises resolved')
	for (const auctionsResponse of otherResponses) {
		allAuctions.push(...auctionsResponse.auctions)
	}

	return {
		pageCount: firstPage.pageCount,
		lastUpdated: firstPage.lastUpdated,
		auctions: allAuctions
	}
}
/**
 * this is expensive and takes about a few seconds, use cached.fetchAllAuctions instead
 */
export async function fetchAllEndedAuctionsUncached(): Promise<AuctionsResponse> {
	return await sendCleanApiRequest({
		path: 'skyblock/auctions_ended',
		args: {}
	})
}


export async function getItemLowestBin(item: Partial<Item>): Promise<number> {
	console.log('ok getting auctions')
	const auctions = await cached.fetchAllAuctions()
	const binAuctions = auctions.filter(a => a.bin)
	// find all bin auctions that are identical, but ignoring enchants (we're calculating those in a moment)
	const matchingBins = binAuctions
		.filter(
			a =>
			(!item.id || a.item.id === item.id) &&
			(!item.vanillaId || a.item.vanillaId === item.vanillaId) &&
			(!item.pet_type || a.item.pet_type === item.pet_type) &&
			(!item.tier || a.item.tier === item.tier) &&
			(!item.potion_type || a.item.potion_type === item.potion_type) &&
			(!item.potion_duration_level || a.item.potion_duration_level === item.potion_duration_level) &&
			(!item.potion_effectiveness_level || a.item.potion_effectiveness_level === item.potion_effectiveness_level) &&
			(!item.potion_level || a.item.potion_level === item.potion_level)
		)
	
	const enchantments = item.enchantments ?? {}

	// if it's an enchanted book with one enchant, we don't have to take enchants into account
	if (item.id === 'ENCHANTED_BOOK' && Object.keys(enchantments).length === 1) {
		// it's an enchanted book with one enchantment, so we can just filter by that enchantment
		const matchingEnchantedBooks = matchingBins.filter(
			a => {
				if (!a.item.enchantments || Object.keys(a.item.enchantments).length !== 1)
					// filter out all auctions that don't have exactly one enchantment
					return false

				if (Object.keys(a.item.enchantments)[0] !== Object.keys(enchantments)[0])
					// filter out all auctions that don't have the same enchantment
					return false

				if (Object.values(a.item.enchantments)[0] !== Object.values(enchantments)[0])
					// filter out all auctions that don't have the same enchantment level
					return false

				return true
			}
		)
		// return the price of the cheapest book
		return matchingEnchantedBooks.sort((a, b) => a.bidAmount - b.bidAmount)[0].bidAmount
	}

	let lowestBin = Number.MAX_SAFE_INTEGER

	for (const auction of matchingBins) {
		const auctionBasePrice = auction.bidAmount
		const auctionMissingEnchantments = Object.keys(enchantments).filter(
			enchantment => !(
				auction.item.enchantments
				&& auction.item.enchantments[enchantment]
				&& enchantments[enchantment] === auction.item.enchantments[enchantment]
			)
		)

		// add the value of all the enchantments (-10k) to the base price of the auction
		let auctionEnchantmentsPrice = 0
		for (const enchantment of auctionMissingEnchantments) {
			const enchantmentValue = await getEnchantmentBinPrice(enchantment, enchantments[enchantment])
			// the reason we subtract 10k is because books are usually more expensive
			auctionEnchantmentsPrice += Math.max(enchantmentValue - 10_000, 0)
		}

		const auctionPrice = auctionBasePrice + auctionEnchantmentsPrice

		if (auctionPrice < lowestBin)
			lowestBin = auctionPrice
	}

	return lowestBin
}

async function getEnchantmentBinPrice(enchantmentName: string, enchantmentLevel: number): Promise<number> {
	const enchantments: Record<string, number> = {}
	enchantments[enchantmentName] = enchantmentLevel
	return await getItemLowestBin({
		id: 'ENCHANTED_BOOK',
		enchantments
	})
}

// setTimeout(() => { getAuctionLowestBin(null) }, 1000)