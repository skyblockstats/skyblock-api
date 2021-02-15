/**
 * Fetch the clean and cached Hypixel API
 */

import NodeCache from 'node-cache'
import * as mojang from './mojang'
import * as hypixel from './hypixel'
import { CleanPlayer } from './cleaners/player'
import { undashUuid } from './util'
import { CleanProfile, CleanFullProfile, CleanBasicProfile } from './cleaners/skyblock/profile'


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
	useClones: false,
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

/**
 * Fetch the uuid from a user
 * @param user A user can be either a uuid or a username 
 */
export async function uuidFromUser(user: string): Promise<string> {
	if (usernameCache.has(undashUuid(user)))
		// check if the uuid is a key
		return undashUuid(user)

	// check if the username is a value
	const uuidToUsername: {[ key: string ]: string} = usernameCache.mget(usernameCache.keys())
	for (const [ uuid, username ] of Object.entries(uuidToUsername)) {
		if (user.toLowerCase() === username.toLowerCase())
			return uuid
	}

	// not cached, actually fetch mojang api now
	let { uuid, username } = await mojang.mojangDataFromUser(user)

	// remove dashes from the uuid so its more normal
	uuid = undashUuid(uuid)
	usernameCache.set(uuid, username)
	return uuid
}

/**
 * Fetch the username from a user
 * @param user A user can be either a uuid or a username 
 */
export async function usernameFromUser(user: string): Promise<string> {
	if (usernameCache.has(undashUuid(user))) {
		return usernameCache.get(undashUuid(user))
	}

	let { uuid, username } = await mojang.mojangDataFromUser(user)
	uuid = undashUuid(uuid)
	usernameCache.set(uuid, username)
	return username
}


export async function fetchPlayer(user: string): Promise<CleanPlayer> {
	const playerUuid = await uuidFromUser(user)

	if (playerCache.has(playerUuid)) {
		console.log('cache hit! fetchPlayer', playerUuid)
		return playerCache.get(playerUuid)
	}

	const cleanPlayer: CleanPlayer = await hypixel.sendCleanApiRequest({
		path: 'player',
		args: { uuid: playerUuid }
	})

	// clone in case it gets modified somehow later
	const cleanPlayerClone = Object.assign({}, cleanPlayer)
	playerCache.set(playerUuid, cleanPlayerClone)

	return cleanPlayer
}


export async function fetchSkyblockProfiles(playerUuid: string): Promise<CleanProfile[]> {
	if (profilesCache.has(playerUuid)) {
		console.log('cache hit! fetchSkyblockProfiles', playerUuid)
		return profilesCache.get(playerUuid)
	}

	const profiles: CleanFullProfile[] = await hypixel.sendCleanApiRequest({
		path: 'skyblock/profiles',
		args: {
			uuid: playerUuid
		}},
		null,
		{
			// only the inventories for the main player are generated, this is for optimization purposes
			mainMemberUuid: playerUuid
		}
	)

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
					last_save: m.last_save
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
		console.log('cache hit! fetchBasicProfiles')
		return basicProfilesCache.get(playerUuid)
	}
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
	if (!profile) return null

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
		console.log('cache hit! fetchProfile')
		// we have the profile cached, return it :)
		return profileCache.get(profileUuid)
	}

	const profileName = await fetchProfileName(user, profile)

	const cleanProfile: CleanFullProfile = await hypixel.sendCleanApiRequest(
		{
			path: 'skyblock/profile',
			args: { profile: profileUuid }
		},
		null,
		{ mainMemberUuid: playerUuid }
	)

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
		console.log('cache hit! fetchProfileName')
		return profileNameCache.get(`${playerUuid}.${profileUuid}`)
	}

	const basicProfiles = await fetchBasicProfiles(playerUuid)
	let profileName
	for (const basicProfile of basicProfiles)
		if (basicProfile.uuid === playerUuid)
			profileName = basicProfile.name

	profileNameCache.set(`${playerUuid}.${profileUuid}`, profileName)
	return profileName
}