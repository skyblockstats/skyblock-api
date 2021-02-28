/**
 * Fetch the clean and cached Hypixel API
 */

import NodeCache, { EventEmitter, Key } from 'node-cache'
import * as mojang from './mojang'
import * as hypixel from './hypixel'
import { CleanPlayer } from './cleaners/player'
import { undashUuid } from './util'
import { CleanProfile, CleanFullProfile, CleanBasicProfile } from './cleaners/skyblock/profile'
import { debug } from '.'

// cache usernames for 4 hours
const usernameCache = new NodeCache({
	stdTTL: 60 * 60 * 4,
	checkperiod: 60,
	useClones: false,
})

const basicProfilesCache = new NodeCache({
	stdTTL: 60 * 10,
	checkperiod: 60,
	useClones: false,
})

const playerCache = new NodeCache({
	stdTTL: 60,
	checkperiod: 10,
	useClones: false,
})

const profileCache = new NodeCache({
	stdTTL: 30,
	checkperiod: 10,
	useClones: true,
})

const profilesCache = new NodeCache({
	stdTTL: 60 * 3,
	checkperiod: 10,
	useClones: false,
})

const profileNameCache = new NodeCache({
	stdTTL: 60 * 60,
	checkperiod: 60,
	useClones: false,
})

function waitForSet(cache: NodeCache, key?: string, value?: string): Promise<any> {
	return new Promise((resolve, reject) => {
		const listener = (setKey, setValue) => {
			if (setKey === key || (value && setValue === value)) {
				cache.removeListener('set', listener)
				return resolve({ key, value })
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
	if (usernameCache.has(undashUuid(user))) {
		// check if the uuid is a key
		const username: any = usernameCache.get(undashUuid(user))
		// if it has .then, then that means its a waitForSet promise. This is done to prevent requests made while it is already requesting
		if (username.then) {
			return (await username()).key
		} else
			return undashUuid(user)
	}

	// check if the username is a value
	const uuidToUsername: {[ key: string ]: string} = usernameCache.mget(usernameCache.keys())
	for (const [ uuid, username ] of Object.entries(uuidToUsername)) {
		if (username.toLowerCase && user.toLowerCase() === username.toLowerCase())
			return uuid
	}

	if (debug) console.log('Cache miss: uuidFromUser', user)

	// set it as waitForSet (a promise) in case uuidFromUser gets called while its fetching mojang
	usernameCache.set(undashUuid(user), waitForSet(usernameCache, user, user))
	
	// not cached, actually fetch mojang api now
	let { uuid, username } = await mojang.mojangDataFromUser(user)
	if (!uuid) return

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
		if (debug) console.log('Cache hit! usernameFromUser', user)
		return usernameCache.get(undashUuid(user))
	}

	if (debug) console.log('Cache miss: usernameFromUser', user)

	let { uuid, username } = await mojang.mojangDataFromUser(user)
	uuid = undashUuid(uuid)
	usernameCache.set(uuid, username)
	return username
}


export async function fetchPlayer(user: string): Promise<CleanPlayer> {
	const playerUuid = await uuidFromUser(user)

	if (playerCache.has(playerUuid)) {
		return playerCache.get(playerUuid)
	}

	const cleanPlayer: CleanPlayer = await hypixel.sendCleanApiRequest({
		path: 'player',
		args: { uuid: playerUuid }
	})

	// clone in case it gets modified somehow later
	const cleanPlayerClone = Object.assign({}, cleanPlayer)
	playerCache.set(playerUuid, cleanPlayerClone)
	usernameCache.set(playerUuid, cleanPlayerClone.username)

	return cleanPlayer
}


export async function fetchSkyblockProfiles(playerUuid: string): Promise<CleanProfile[]> {
	if (profilesCache.has(playerUuid)) {
		if (debug) console.log('Cache hit! fetchSkyblockProfiles', playerUuid)
		return profilesCache.get(playerUuid)
	}

	if (debug) console.log('Cache miss: fetchSkyblockProfiles', playerUuid)

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
	if (basicProfilesCache.has(playerUuid)) {
		if (debug) console.log('Cache hit! fetchBasicProfiles', playerUuid)
		return basicProfilesCache.get(playerUuid)
	}

	if (debug) console.log('Cache miss: fetchBasicProfiles', user)

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
export async function fetchProfileUuid(user: string, profile: string) {
	// if a profile wasn't provided, return
	if (!profile) {
		if (debug) console.log('no profile provided?', user, profile)
		return null
	}

	if (debug) console.log('Cache miss: fetchProfileUuid', user)

	const profiles = await fetchBasicProfiles(user)

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
		if (debug) console.log('Cache hit! fetchProfile', profileUuid)
		return profileCache.get(profileUuid)
	}

	if (debug) console.log('Cache miss: fetchProfile', user, profile)

	const profileName = await fetchProfileName(user, profile)

	const cleanProfile: CleanFullProfile = await hypixel.fetchMemberProfileUncached(playerUuid, profileUuid)

	// we know the name from fetchProfileName, so set it here
	cleanProfile.name = profileName

	profileCache.set(profileUuid, cleanProfile)

	return cleanProfile
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
		if (debug) console.log('Cache hit! fetchProfileName', profileUuid)
		return profileNameCache.get(`${playerUuid}.${profileUuid}`)
	}

	if (debug) console.log('Cache miss: fetchProfileName', user, profile)

	const basicProfiles = await fetchBasicProfiles(playerUuid)
	let profileName
	for (const basicProfile of basicProfiles)
		if (basicProfile.uuid === playerUuid)
			profileName = basicProfile.name

	profileNameCache.set(`${playerUuid}.${profileUuid}`, profileName)
	return profileName
}