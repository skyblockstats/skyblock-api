/**
 * Fetch the clean and cached Hypixel API
 */

import { CleanProfile, CleanFullProfile, CleanBasicProfile } from './cleaners/skyblock/profile.js'
import { isUuid, sleep, undashUuid } from './util.js'
import { CleanPlayer } from './cleaners/player.js'
import * as hypixel from './hypixel.js'
import * as mojang from './mojang.js'
import NodeCache from 'node-cache'
import { debug } from './index.js'
import LRUCache from 'lru-cache'
import { CleanBasicMember } from './cleaners/skyblock/member.js'

// cache usernames for 30 minutes

/** uuid: username */
export const usernameCache = new NodeCache({
	// stdTTL: 60 * 60 * 4,
	stdTTL: 60 * 30,
	checkperiod: 60,
	useClones: false,
})

usernameCache.setMaxListeners(200)


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

// cache "basic players" (players without profiles) for 20 minutes
export const basicPlayerCache: LRUCache<string, CleanPlayer> = new LRUCache({
	max: 10000,
	ttl: 60 * 20 * 1000,
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
			// we check that the setValue isn't a promise because it's often
			// set as a promise for this exact function
			if (((setKey === key) || (value && setValue === value)) && (!setValue?.then)) {
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
export async function uuidFromUser(user: string): Promise<string | undefined> {
	// if the user is 32 characters long, it has to be a uuid
	if (isUuid(user))
		return undashUuid(user)

	if (usernameCache.has(undashUuid(user))) {
		// check if the uuid is a key
		const username: Promise<KeyValue> | string | undefined = usernameCache.get<string | Promise<KeyValue>>(undashUuid(user))

		// sometimes the username will be null, return that
		if (username === null) return undefined

		// if it has .then, then that means its a waitForCacheSet promise. This is done to prevent requests made while it is already requesting
		if ((username as Promise<KeyValue>).then) {
			const { key: uuid, value: _username } = await (username as Promise<KeyValue>)
			usernameCache.set<string | Promise<KeyValue>>(uuid, _username)
			return uuid
		} else
			return undashUuid(user)
	}

	// check if the username is a value
	const uuidToUsername: { [key: string]: string | Promise<KeyValue> } = usernameCache.mget(usernameCache.keys())
	for (const [uuid, username] of Object.entries(uuidToUsername)) {
		if (username && (<string>username).toLowerCase && user.toLowerCase() === (<string>username).toLowerCase())
			return uuid
	}

	if (debug) console.debug('Cache miss: uuidFromUser', user)

	const undashedUser = undashUuid(user)

	// set it as waitForCacheSet (a promise) in case uuidFromUser gets called while its fetching mojang
	usernameCache.set(undashedUser, waitForCacheSet(usernameCache, user, user))

	// not cached, actually fetch mojang api now
	let { uuid, username } = await mojang.profileFromUser(user)
	if (!uuid) {
		usernameCache.set(user, null)
		return
	}

	// remove dashes from the uuid so its more normal
	uuid = undashUuid(uuid)

	usernameCache.del(undashedUser)

	usernameCache.set(uuid, username)
	return uuid
}

/**
 * Fetch the username from a user
 * @param user A user can be either a uuid or a username 
 */
export async function usernameFromUser(user: string): Promise<string | null> {
	if (usernameCache.has(undashUuid(user))) {
		if (debug) console.debug('Cache hit! usernameFromUser', user)
		return usernameCache.get(undashUuid(user)) ?? null
	}

	if (debug) console.debug('Cache miss: usernameFromUser', user)

	let { uuid, username } = await mojang.profileFromUser(user)
	if (!uuid) return null
	uuid = undashUuid(uuid)
	usernameCache.set(uuid, username)
	return username
}

let fetchingPlayers: Set<string> = new Set()

export async function fetchPlayer(user: string): Promise<CleanPlayer | null> {
	const playerUuid = await uuidFromUser(user)
	if (!playerUuid) return null

	if (playerCache.has(playerUuid))
		return playerCache.get(playerUuid)!

	// if it's already in the process of fetching, check every 100ms until it's not fetching the player anymore and fetch it again, since it'll be cached now
	if (fetchingPlayers.has(playerUuid)) {
		while (fetchingPlayers.has(playerUuid)) {
			await sleep(100)
		}
		return await fetchPlayer(user)
	}

	fetchingPlayers.add(playerUuid)

	const cleanPlayer = await hypixel.sendCleanApiRequest('player',
		{ uuid: playerUuid }
	)

	fetchingPlayers.delete(playerUuid)

	if (!cleanPlayer) return null

	playerCache.set(playerUuid, cleanPlayer)
	usernameCache.set(playerUuid, cleanPlayer.username)

	// clone in case it gets modified somehow later
	const cleanBasicPlayer = Object.assign({}, cleanPlayer)
	if (cleanBasicPlayer.profiles) {
		// remove the names from the profiles so we only keep uuids
		// this helps save a bit of memory since we don't care about the names
		cleanBasicPlayer.profiles = cleanBasicPlayer.profiles.map(p => ({ uuid: p.uuid }))
	}
	basicPlayerCache.set(playerUuid, cleanBasicPlayer)

	return cleanPlayer
}

/** Fetch a player without their profiles. This is heavily cached. */
export async function fetchBasicPlayer(user: string, includeClaimed: boolean = true): Promise<CleanPlayer | null> {
	const playerUuid = await uuidFromUser(user)

	if (!playerUuid) return null

	if (basicPlayerCache.has(playerUuid)) {
		const player = basicPlayerCache.get(playerUuid)!
		if (!includeClaimed)
			delete player.claimed
		return player
	}

	const player = await fetchPlayer(playerUuid)
	if (!player) {
		console.debug('no player? this should never happen, perhaps the uuid is invalid or the player hasn\'t played hypixel', playerUuid)
		return null
	}

	delete player.profiles
	if (!includeClaimed)
		delete player.claimed
	return player
}

export async function fetchSkyblockProfiles(playerUuid: string): Promise<CleanProfile[]> {
	if (profilesCache.has(playerUuid)) {
		if (debug) console.debug('Cache hit! fetchSkyblockProfiles', playerUuid)
		return profilesCache.get(playerUuid)!
	}

	if (debug) console.debug('Cache miss: fetchSkyblockProfiles', playerUuid)

	const profiles: CleanFullProfile[] = await hypixel.fetchMemberProfilesUncached(playerUuid)

	const basicProfiles: CleanProfile[] = []

	// create the basicProfiles array
	for (const profile of profiles) {
		const basicProfile: CleanProfile = {
			name: profile.name,
			uuid: profile.uuid,
			members: profile.members?.map((m): CleanBasicMember => {
				return {
					uuid: m.uuid,
					username: m.username,
					firstJoin: m.firstJoin,
					lastSave: m.lastSave,
					rank: m.rank,
					left: m.left
				}
			})
		}
		basicProfiles.push(basicProfile)
	}

	basicProfiles.sort((a, b) => {
		const memberA = a.members?.find(m => m.uuid === playerUuid)
		const memberB = b.members?.find(m => m.uuid === playerUuid)
		if (!memberA || !memberB || !memberA.lastSave || !memberB.lastSave) return 0
		return memberB.lastSave - memberA.lastSave
	})

	// cache the profiles
	profilesCache.set(playerUuid, basicProfiles)

	return basicProfiles
}

/** Fetch an array of `BasicProfile`s */
async function fetchBasicProfiles(user: string): Promise<CleanBasicProfile[] | null> {
	const playerUuid = await uuidFromUser(user)

	if (!playerUuid) return null // invalid player, just return

	if (basicProfilesCache.has(playerUuid)) {
		if (debug) console.debug('Cache hit! fetchBasicProfiles', playerUuid)
		return basicProfilesCache.get(playerUuid)!
	}

	if (debug) console.debug('Cache miss: fetchBasicProfiles', user)

	const player = await fetchPlayer(playerUuid)
	if (!player) {
		// this happens when the player changed their name recently and the old name is cached on hypixel
		return []
	}
	const profiles = player.profiles
	basicProfilesCache.set(playerUuid, profiles)
	if (!profiles) return null

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
export async function fetchProfileUuid(user: string, profile: string): Promise<string | null> {
	// if a profile wasn't provided, return
	if (!profile) {
		if (debug) console.debug('no profile provided?', user, profile)
		return null
	}

	if (debug) console.debug('Cache miss: fetchProfileUuid', user, profile)

	const profiles = await fetchBasicProfiles(user)
	if (!profiles) return null // user probably doesnt exist

	const profileUuid = undashUuid(profile)

	for (const p of profiles) {
		if (p.name?.toLowerCase() === profileUuid.toLowerCase())
			return undashUuid(p.uuid)
		else if (undashUuid(p.uuid) === undashUuid(profileUuid))
			return undashUuid(p.uuid)
	}
	return null
}

/**
 * Fetch an entire profile from the user and profile data
 * @param user A username or uuid
 * @param profile A profile name or profile uuid
 */
export async function fetchProfile(user: string, profile: string): Promise<CleanFullProfile | null> {
	const playerUuid = await uuidFromUser(user)
	if (!playerUuid) return null
	const profileUuid = await fetchProfileUuid(playerUuid, profile)

	if (!profileUuid) return null

	if (profileCache.has(profileUuid)) {
		// we have the profile cached, return it :)
		if (debug) console.debug('Cache hit! fetchProfile', profileUuid)
		return profileCache.get(profileUuid)!
	}

	if (debug) console.debug('Cache miss: fetchProfile', user, profile)

	const profileName = await fetchProfileName(user, profile)

	if (!profileName) return null // uhh this should never happen but if it does just return null

	const cleanProfile = await hypixel.fetchMemberProfileUncached(playerUuid, profileUuid)
	if (!cleanProfile) return null

	// we know the name from fetchProfileName, so set it here
	cleanProfile.name = profileName

	profileCache.set(profileUuid, cleanProfile)

	return cleanProfile
}

/**
 * Fetch a CleanProfile from the uuid
 * @param profileUuid A profile name or profile uuid
*/
export async function fetchBasicProfileFromUuid(profileUuid: string): Promise<CleanProfile | null> {
	if (profileCache.has(profileUuid)) {
		// we have the profile cached, return it :)
		if (debug) console.debug('Cache hit! fetchBasicProfileFromUuid', profileUuid)
		const profile: CleanFullProfile | undefined = profileCache.get(profileUuid)
		if (!profile) return null
		return {
			uuid: profile.uuid,
			members: profile.members.map(m => ({
				uuid: m.uuid,
				username: m.username,
				lastSave: m.lastSave,
				firstJoin: m.firstJoin,
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
export async function fetchProfileName(user: string, profile: string): Promise<string | null> {
	// we're fetching the profile and player uuid again in case we were given a name, but it's cached so it's not much of a problem
	const profileUuid = await fetchProfileUuid(user, profile)
	if (!profileUuid) return null

	const playerUuid = await uuidFromUser(user)

	if (!playerUuid) return null

	if (profileNameCache.has(`${playerUuid}.${profileUuid}`)) {
		// Return the profile name if it's cached
		if (debug) console.debug('Cache hit! fetchProfileName', profileUuid)
		return profileNameCache.get!(`${playerUuid}.${profileUuid}`) ?? null
	}

	if (debug) console.debug('Cache miss: fetchProfileName', user, profile)

	const basicProfiles = await fetchBasicProfiles(playerUuid)

	if (!basicProfiles) return null

	let profileName: string | null = null

	for (const basicProfile of basicProfiles)
		if (basicProfile.uuid === playerUuid)
			profileName = basicProfile.name ?? null

	profileNameCache.set(`${playerUuid}.${profileUuid}`, profileName)
	return profileName
}
