/**
 * Fetch the clean Hypixel API
 */

import { CleanPlayer, cleanPlayerResponse } from './cleaners/player'
import { chooseApiKey, HypixelResponse, sendApiRequest } from './hypixelApi'
import * as cached from './hypixelCached'
import { CleanMemberProfile } from './cleaners/skyblock/member'
import { cleanSkyblockProfileResponse, CleanProfile, CleanBasicProfile } from './cleaners/skyblock/profile'
import { cleanSkyblockProfilesResponse } from './cleaners/skyblock/profiles'

export type Included = 'profiles' | 'player' | 'stats'

// the interval at which the "last_save" parameter updates in the hypixel api, this is 3 minutes
export const saveInterval = 60 * 3 * 1000

// the highest level a minion can be
export const maxMinion = 11

/**
 *  Send a request to api.hypixel.net using a random key, clean it up to be more useable, and return it 
 */ 
export async function sendCleanApiRequest({ path, args }, included?: Included[], cleaned=true) {
    const key = await chooseApiKey()
    const rawResponse = await sendApiRequest({ path, key, args })
    if (rawResponse.throttled) {
		// if it's throttled, wait a second and try again
        console.log('throttled :/')
		await new Promise(resolve => setTimeout(resolve, 1000))
        return await sendCleanApiRequest({ path, args }, included, cleaned)
    }
    if (cleaned) {
		// if it needs to clean the response, call cleanResponse
        return await cleanResponse({ path, data: rawResponse }, included=included)
    } else {
        // this is provided in case the caller wants to do the cleaning itself
        // used in skyblock/profile, as cleaning the entire profile would use too much cpu
        return rawResponse
    }
}



async function cleanResponse({ path, data }: { path: string, data: HypixelResponse }, included?: Included[]) {
    // Cleans up an api response
    switch (path) {
        case 'player': return await cleanPlayerResponse(data.player)
        case 'skyblock/profile': return await cleanSkyblockProfileResponse(data.profile)
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
    player: any
    profiles?: any
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

