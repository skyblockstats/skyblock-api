/**
 * Fetch the clean and cached Hypixel API
 */

import { CleanProfile, CleanFullProfile, CleanBasicProfile } from './cleaners/skyblock/profile'
import { Auction } from './cleaners/skyblock/auctions'
import { fetchAllAuctionsUncached } from './hypixel'
import { CleanPlayer } from './cleaners/player'
import { isUuid, undashUuid } from './util'
import * as hypixel from './hypixel'
import * as mojang from './mojang'
import NodeCache from 'node-cache'
import Queue from 'queue-promise'
import { debug } from '.'

// cache usernames for 4 hours
/** uuid: username */
export const usernameCache = new NodeCache({
	stdTTL: 60 * 60 * 4,
	checkperiod: 60,
	useClones: false,
})

export const basicProfilesCache = new NodeCache({
	stdTTL: 60 * 10,
	checkperiod: 60,
	useClones: true,
})

export const playerCache = new NodeCache({
	stdTTL: 60,
	checkperiod: 10,
	useClones: true,
})

// cache "basic players" (players without profiles) for 4 hours
export const basicPlayerCache = new NodeCache({
	stdTTL: 60 * 60 * 4,
	checkperiod: 60 * 10,
	useClones: true
})

export const profileCache = new NodeCache({
	stdTTL: 30,
	checkperiod: 10,
	useClones: true,
})

export const profilesCache = new NodeCache({
	stdTTL: 60 * 3,
	checkperiod: 10,
	useClones: false,
})

export const profileNameCache = new NodeCache({
	stdTTL: 60 * 60,
	checkperiod: 60,
	useClones: false,
})


interface KeyValue {
	key: any
	value: any
}

function waitForCacheSet(cache: NodeCache, key?: string, value?: string): Promise<KeyValue> {
	return new Promise((resolve, reject) => {
		const listener = (setKey, setValue) => {
			if (setKey === key || (value && setValue === value)) {
				cache.removeListener('set', listener)
				return resolve({ key: setKey, value: setValue })
			}
		}
		cache.on('set', listener)
	})
}

/**
 * Fetch the uuid from a user
 * @param user A user can be either a uuid or a username 
 */
export async function uuidFromUser(user: string): Promise<string> {
	// if the user is 32 characters long, it has to be a uuid
	if (isUuid(user))
		return undashUuid(user)

	if (usernameCache.has(undashUuid(user))) {
		// check if the uuid is a key
		const username: any = usernameCache.get(undashUuid(user))

		// sometimes the username will be null, return that
		if (username === null) return username

		// if it has .then, then that means its a waitForCacheSet promise. This is done to prevent requests made while it is already requesting
		if (username.then) {
			const { key: uuid, value: _username } = await username
			usernameCache.set(uuid, _username)
			return uuid
		} else
			return undashUuid(user)
	}

	// check if the username is a value
	const uuidToUsername: {[ key: string ]: string} = usernameCache.mget(usernameCache.keys())
	for (const [ uuid, username ] of Object.entries(uuidToUsername)) {
		if (username && username.toLowerCase && user.toLowerCase() === username.toLowerCase())
			return uuid
	}

	if (debug) console.debug('Cache miss: uuidFromUser', user)

	// set it as waitForCacheSet (a promise) in case uuidFromUser gets called while its fetching mojang
	usernameCache.set(undashUuid(user), waitForCacheSet(usernameCache, user, user))
	
	// not cached, actually fetch mojang api now
	let { uuid, username } = await mojang.profileFromUser(user)
	if (!uuid) {
		usernameCache.set(user, null)
		return
	}

	// remove dashes from the uuid so its more normal
	uuid = undashUuid(uuid)

	if (user !== uuid) usernameCache.del(user)

	usernameCache.set(uuid, username)
	return uuid
}

/**
 * Fetch the username from a user
 * @param user A user can be either a uuid or a username 
 */
export async function usernameFromUser(user: string): Promise<string> {
	if (usernameCache.has(undashUuid(user))) {
		if (debug) console.debug('Cache hit! usernameFromUser', user)
		return usernameCache.get(undashUuid(user))
	}

	if (debug) console.debug('Cache miss: usernameFromUser', user)

	let { uuid, username } = await mojang.profileFromUser(user)
	uuid = undashUuid(uuid)
	usernameCache.set(uuid, username)
	return username
}

let fetchingPlayers: Set<string> = new Set()

export async function fetchPlayer(user: string): Promise<CleanPlayer> {
	const playerUuid = await uuidFromUser(user)


	if (playerCache.has(playerUuid))
		return playerCache.get(playerUuid)

	// if it's already in the process of fetching, check every 100ms until it's not fetching the player anymore and fetch it again, since it'll be cached now
	if (fetchingPlayers.has(playerUuid)) {
		while (fetchingPlayers.has(playerUuid)) {
			await new Promise(resolve => setTimeout(resolve, 100))
		}
		return await fetchPlayer(user)
	}

	fetchingPlayers.add(playerUuid)

	const cleanPlayer: CleanPlayer = await hypixel.sendCleanApiRequest({
		path: 'player',
		args: { uuid: playerUuid }
	})

	fetchingPlayers.delete(playerUuid)

	if (!cleanPlayer) return

	// clone in case it gets modified somehow later
	playerCache.set(playerUuid, cleanPlayer)
	usernameCache.set(playerUuid, cleanPlayer.username)
	
	const cleanBasicPlayer = Object.assign({}, cleanPlayer)
	delete cleanBasicPlayer.profiles
	basicPlayerCache.set(playerUuid, cleanBasicPlayer)

	return cleanPlayer
}

/** Fetch a player without their profiles. This is heavily cached. */
export async function fetchBasicPlayer(user: string): Promise<CleanPlayer> {
	const playerUuid = await uuidFromUser(user)

	if (basicPlayerCache.has(playerUuid))
		return basicPlayerCache.get(playerUuid)
	
	const player = await fetchPlayer(playerUuid)
	if (!player) console.debug('no player? this should never happen', user)

	delete player.profiles
	return player
}

export async function fetchSkyblockProfiles(playerUuid: string): Promise<CleanProfile[]> {
	if (profilesCache.has(playerUuid)) {
		if (debug) console.debug('Cache hit! fetchSkyblockProfiles', playerUuid)
		return profilesCache.get(playerUuid)
	}

	if (debug) console.debug('Cache miss: fetchSkyblockProfiles', playerUuid)

	const profiles: CleanProfile[] = await hypixel.fetchMemberProfilesUncached(playerUuid)

	const basicProfiles: CleanProfile[] = []

	// create the basicProfiles array
	for (const profile of profiles) {
		const basicProfile: CleanProfile = {
			name: profile.name,
			uuid: profile.uuid,
			members: profile.members.map(m => {
				return {
					uuid: m.uuid,
					username: m.username,
					first_join: m.first_join,
					last_save: m.last_save,
					rank: m.rank
				}
			})
		}
		basicProfiles.push(basicProfile)
	}

	// cache the profiles
	profilesCache.set(playerUuid, basicProfiles)

	return basicProfiles
}

/** Fetch an array of `BasicProfile`s */
async function fetchBasicProfiles(user: string): Promise<CleanBasicProfile[]> {
	const playerUuid = await uuidFromUser(user)

	if (!playerUuid) return // invalid player, just return

	if (basicProfilesCache.has(playerUuid)) {
		if (debug) console.debug('Cache hit! fetchBasicProfiles', playerUuid)
		return basicProfilesCache.get(playerUuid)
	}

	if (debug) console.debug('Cache miss: fetchBasicProfiles', user)

	const player = await fetchPlayer(playerUuid)
	const profiles = player.profiles
	basicProfilesCache.set(playerUuid, profiles)

	// cache the profile names and uuids to profileNameCache because we can
	for (const profile of profiles)
		profileNameCache.set(`${playerUuid}.${profile.uuid}`, profile.name)

	return profiles
}

/**
 * Fetch a profile UUID from its name and user
 * @param user A username or uuid
 * @param profile A profile name or profile uuid
 */
export async function fetchProfileUuid(user: string, profile: string): Promise<string> {
	// if a profile wasn't provided, return
	if (!profile) {
		if (debug) console.debug('no profile provided?', user, profile)
		return null
	}

	if (debug) console.debug('Cache miss: fetchProfileUuid', user)

	const profiles = await fetchBasicProfiles(user)
	if (!profiles) return // user probably doesnt exist

	const profileUuid = undashUuid(profile)

	for (const p of profiles) {
		if (p.name.toLowerCase() === profileUuid.toLowerCase())
			return undashUuid(p.uuid)
		else if (undashUuid(p.uuid) === undashUuid(profileUuid))
			return undashUuid(p.uuid)
	}
}

/**
 * Fetch an entire profile from the user and profile data
 * @param user A username or uuid
 * @param profile A profile name or profile uuid
 */
export async function fetchProfile(user: string, profile: string): Promise<CleanFullProfile> {
	const playerUuid = await uuidFromUser(user)
	const profileUuid = await fetchProfileUuid(playerUuid, profile)

	if (profileCache.has(profileUuid)) {
		// we have the profile cached, return it :)
		if (debug) console.debug('Cache hit! fetchProfile', profileUuid)
		return profileCache.get(profileUuid)
	}

	if (debug) console.debug('Cache miss: fetchProfile', user, profile)

	const profileName = await fetchProfileName(user, profile)

	const cleanProfile: CleanFullProfile = await hypixel.fetchMemberProfileUncached(playerUuid, profileUuid)

	// we know the name from fetchProfileName, so set it here
	cleanProfile.name = profileName

	profileCache.set(profileUuid, cleanProfile)

	return cleanProfile
}

/**
 * Fetch a CleanProfile from the uuid
 * @param profileUuid A profile name or profile uuid
*/
export async function fetchBasicProfileFromUuid(profileUuid: string): Promise<CleanProfile> {
	if (profileCache.has(profileUuid)) {
		// we have the profile cached, return it :)
		if (debug) console.debug('Cache hit! fetchBasicProfileFromUuid', profileUuid)
		const profile: CleanFullProfile = profileCache.get(profileUuid)
		return {
			uuid: profile.uuid,
			members: profile.members.map(m => ({
				uuid: m.uuid,
				username: m.username,
				last_save: m.last_save,
				first_join: m.first_join,
				rank: m.rank,
			})),
			name: profile.name
		}
	}
	// TODO: cache this
	return await hypixel.fetchBasicProfileFromUuidUncached(profileUuid)
}


/**
 * Fetch the name of a profile from the user and profile uuid
 * @param user A player uuid or username
 * @param profile A profile uuid or name
 */
export async function fetchProfileName(user: string, profile: string): Promise<string> {
	// we're fetching the profile and player uuid again in case we were given a name, but it's cached so it's not much of a problem
	const profileUuid = await fetchProfileUuid(user, profile)
	const playerUuid = await uuidFromUser(user)

	if (profileNameCache.has(`${playerUuid}.${profileUuid}`)) {
		// Return the profile name if it's cached
		if (debug) console.debug('Cache hit! fetchProfileName', profileUuid)
		return profileNameCache.get(`${playerUuid}.${profileUuid}`)
	}

	if (debug) console.debug('Cache miss: fetchProfileName', user, profile)

	const basicProfiles = await fetchBasicProfiles(playerUuid)
	let profileName
	for (const basicProfile of basicProfiles)
		if (basicProfile.uuid === playerUuid)
			profileName = basicProfile.name

	profileNameCache.set(`${playerUuid}.${profileUuid}`, profileName)
	return profileName
}

let allAuctionsCache: Auction[] = []
let nextAuctionsUpdate = 0
let nextAuctionsUpdateTimeout = null

// we use a queue so it doesnt fetch twice at the same time, and instead it waits so it can just use the cached version
const fetchAllAuctionsQueue = new Queue({
	concurrent: 1
})

/**
 * Fetch an array of all active Auctions 
 */
export async function fetchAllAuctions(): Promise<Auction[]> {
	if (Date.now() / 1000 > nextAuctionsUpdate) {
		fetchAllAuctionsQueue.enqueue(fetchAllAuctionsUncached)
		const auctionsResponse = await fetchAllAuctionsQueue.dequeue()

		allAuctionsCache = auctionsResponse.auctions

		// the auctions endpoint updates every 60 seconds
		nextAuctionsUpdate = auctionsResponse.lastUpdated + 60

		// if there's already a timeout, clear it and make a new one
		if (nextAuctionsUpdateTimeout)
			clearTimeout(nextAuctionsUpdateTimeout)
		// make a timeout for the next auctions update
		nextAuctionsUpdateTimeout = setTimeout(fetchAllAuctions, Date.now() - nextAuctionsUpdate * 1000)
	}
	return allAuctionsCache
}
