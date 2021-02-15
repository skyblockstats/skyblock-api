/**
 * Fetch the clean Hypixel API
 */

import { CleanPlayer, cleanPlayerResponse } from './cleaners/player'
import { chooseApiKey, HypixelResponse, sendApiRequest } from './hypixelApi'
import * as cached from './hypixelCached'
import { CleanBasicMember, CleanMemberProfile } from './cleaners/skyblock/member'
import { cleanSkyblockProfileResponse, CleanProfile, CleanBasicProfile } from './cleaners/skyblock/profile'
import { cleanSkyblockProfilesResponse } from './cleaners/skyblock/profiles'

export type Included = 'profiles' | 'player' | 'stats' | 'inventories'

// the interval at which the "last_save" parameter updates in the hypixel api, this is 3 minutes
export const saveInterval = 60 * 3 * 1000

// the highest level a minion can be
export const maxMinion = 11

/**
 *  Send a request to api.hypixel.net using a random key, clean it up to be more useable, and return it 
 */ 

export interface ApiOptions {
    mainMemberUuid?: string
}

export async function sendCleanApiRequest({ path, args }, included?: Included[], options?: ApiOptions) {
    const key = await chooseApiKey()
    const rawResponse = await sendApiRequest({ path, key, args })
    if (rawResponse.throttled) {
		// if it's throttled, wait a second and try again
        console.log('throttled :/')
		await new Promise(resolve => setTimeout(resolve, 1000))
        return await sendCleanApiRequest({ path, args }, included, options)
    }

    // clean the response
    return await cleanResponse({ path, data: rawResponse }, options ?? {})
}



async function cleanResponse({ path, data }: { path: string, data: HypixelResponse }, options: ApiOptions) {
    // Cleans up an api response
    switch (path) {
        case 'player': return await cleanPlayerResponse(data.player)
        case 'skyblock/profile': return await cleanSkyblockProfileResponse(data.profile, options)
        case 'skyblock/profiles': return await cleanSkyblockProfilesResponse(data.profiles)
    }
}

/* ----------------------------- */

export interface UserAny {
    user?: string
    uuid?: string
    username?: string
}

export interface CleanUser {
    player: CleanPlayer
    profiles?: CleanProfile[]
    activeProfile?: string
    online?: boolean
}


/**
 * Higher level function that requests the api for a user, and returns the cleaned response
 * This is safe to fetch many times because the results are cached!
 * @param included lets you choose what is returned, so there's less processing required on the backend
 * used inclusions: player, profiles
 */
export async function fetchUser({ user, uuid, username }: UserAny, included: Included[]=['player']): Promise<CleanUser> {
    if (!uuid) {
        // If the uuid isn't provided, get it
        uuid = await cached.uuidFromUser(user || username)
    }   

    const includePlayers = included.includes('player')
    const includeProfiles = included.includes('profiles')

    let profilesData: CleanProfile[]
    let basicProfilesData: CleanBasicProfile[]
    let playerData: CleanPlayer

    if (includePlayers) {
        playerData = await cached.fetchPlayer(uuid)
        // if not including profiles, include lightweight profiles just in case
        if (!includeProfiles)
            basicProfilesData = playerData.profiles
        playerData.profiles = undefined
    }
    if (includeProfiles) {
        profilesData = await cached.fetchSkyblockProfiles(uuid)
    }

    let activeProfile: CleanProfile = null
    let lastOnline: number = 0

    if (includeProfiles) {
        for (const profile of profilesData) {
            const member = profile.members.find(member => member.uuid === uuid)
            if (member.last_save > lastOnline) {
                lastOnline = member.last_save
                activeProfile = profile
            }
        }
    }
    return {
        player: playerData ?? null,
        profiles: profilesData ?? basicProfilesData,
        activeProfile: includeProfiles ? activeProfile?.uuid : undefined,
        online: includeProfiles ? lastOnline > (Date.now() - saveInterval): undefined
    }
}

/**
 * Fetch a CleanMemberProfile from a user and string
 * This is safe to use many times as the results are cached!
 * @param user A username or uuid
 * @param profile A profile name or profile uuid
 */
export async function fetchMemberProfile(user: string, profile: string): Promise<CleanMemberProfile> {
    const playerUuid = await cached.uuidFromUser(user)
    const profileUuid = await cached.fetchProfileUuid(user, profile)

    // if the profile doesn't have an id, just return
    if (!profileUuid) return null

    const player = await cached.fetchPlayer(playerUuid)

    const cleanProfile = await cached.fetchProfile(playerUuid, profileUuid)

    const member = cleanProfile.members.find(m => m.uuid === playerUuid)

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

    return {
        member: {
			// the profile name is in member rather than profile since they sometimes differ for each member
            profileName: cleanProfile.name,
			// add all the member data
            ...member,
            // add all other data relating to the hypixel player, such as username, rank, etc
            ...player
        },
        profile: cleanProfile
    }
}
