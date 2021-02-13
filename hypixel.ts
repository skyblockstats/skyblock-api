import { CleanMinion, cleanMinions, combineMinionArrays } from './cleaners/skyblock/minions'
import { CleanProfileStats, cleanProfileStats } from './cleaners/skyblock/stats'
import { CleanPlayer, cleanPlayerResponse } from './cleaners/player'
import { chooseApiKey, HypixelPlayerStatsSkyBlockProfiles, HypixelResponse, sendApiRequest } from './hypixelApi'
import * as cached from './hypixelCached'

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

export interface CleanBasicMember {
    uuid: string
    username: string
    last_save: number
    first_join: number
}

interface CleanMember extends CleanBasicMember {
    stats?: CleanProfileStats
    minions?: CleanMinion[]
}

async function cleanSkyBlockProfileMemberResponse(member, included: Included[] = null): Promise<CleanMember> {
    // Cleans up a member (from skyblock/profile)
    // profiles.members[]
    const statsIncluded = included == null || included.includes('stats')
    return {
        uuid: member.uuid,
        username: await cached.usernameFromUser(member.uuid),
        last_save: member.last_save,
        first_join: member.first_join,
        // last_death: ??? idk how this is formatted,
        stats: statsIncluded ? cleanProfileStats(member.stats) : undefined,
        minions: statsIncluded ? cleanMinions(member.crafted_generators) : undefined,
    }
}


export interface CleanMemberProfilePlayer extends CleanPlayer {
    // The profile name may be different for each player, so we put it here
    profileName: string
    first_join: number
    last_save: number
    bank?: {
        balance: number
        history: any[]
    }
}

export interface CleanMemberProfile {
    member: CleanMemberProfilePlayer
    profile: {
        
    }
}

export interface CleanProfile extends CleanBasicProfile {
    members?: CleanBasicMember[]
}

export interface CleanFullProfile extends CleanProfile {
    members: CleanMember[]
    bank?: {
        balance: number
        history: any[]
    }
    minions: CleanMinion[]
}

/** Return a `CleanProfile` instead of a `CleanFullProfile`, useful when we need to get members but don't want to waste much ram */
async function cleanSkyblockProfileResponseLighter(data): Promise<CleanProfile> {
    // We use Promise.all so it can fetch all the usernames at once instead of waiting for the previous promise to complete
    const promises: Promise<CleanMember>[] = []

    for (const memberUUID in data.members) {
        const memberRaw = data.members[memberUUID]
        memberRaw.uuid = memberUUID
        // we pass an empty array to make it not check stats
        promises.push(cleanSkyBlockProfileMemberResponse(memberRaw, []))
    }

    const cleanedMembers: CleanMember[] = await Promise.all(promises)

    return {
        uuid: data.profile_id,
        name: data.cute_name,
        members: cleanedMembers,
    }
}

/** This function is very costly and shouldn't be called often. Use cleanSkyblockProfileResponseLighter if you don't need all the data */
async function cleanSkyblockProfileResponse(data: any): Promise<CleanFullProfile> {
    const cleanedMembers: CleanMember[] = []

    for (const memberUUID in data.members) {
        const memberRaw = data.members[memberUUID]
        memberRaw.uuid = memberUUID
        const member: CleanMember = await cleanSkyBlockProfileMemberResponse(memberRaw, ['stats'])
        cleanedMembers.push(member)
    }

    const memberMinions: CleanMinion[][] = []

    for (const member of cleanedMembers) {
        memberMinions.push(member.minions)
    }
    const minions: CleanMinion[] = combineMinionArrays(memberMinions)

    // return more detailed info
    return {
        uuid: data.profile_id,
        name: data.cute_name,
        members: cleanedMembers,
        bank: {
            balance: data?.banking?.balance ?? 0,

            // TODO: make transactions good
            history: data?.banking?.transactions ?? []
        },
        minions
    }
}

/** A basic profile that only includes the profile uuid and name */
export interface CleanBasicProfile {
    uuid: string

    // the name depends on the user, so its sometimes not included
    name?: string
}

export function cleanPlayerSkyblockProfiles(rawProfiles: HypixelPlayerStatsSkyBlockProfiles): CleanBasicProfile[] {
    let profiles: CleanBasicProfile[] = []
    for (const profile of Object.values(rawProfiles)) {
        profiles.push({
            uuid: profile.profile_id,
            name: profile.cute_name
        })
    }
    console.log('cleanPlayerSkyblockProfiles', profiles)
    return profiles
}

/** Convert an array of raw profiles into clean profiles */
async function cleanSkyblockProfilesResponse(data: any[]): Promise<CleanProfile[]> {
    const cleanedProfiles: CleanProfile[] = []
    for (const profile of data) {
        let cleanedProfile = await cleanSkyblockProfileResponseLighter(profile)
        cleanedProfiles.push(cleanedProfile)
    }
    return cleanedProfiles
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

/**
 * Fetch a CleanMemberProfile from a user and string
 * This is safe to use many times as the results are cached!
 * @param user A username or uuid
 * @param profile A profile name or profile uuid
 */
export async function fetchMemberProfile(user: string, profile: string): Promise<CleanMemberProfile> {
    const playerUuid = await cached.uuidFromUser(user)
    const profileUuid = await cached.fetchProfileUuid(user, profile)

    const player = await cached.fetchPlayer(playerUuid)

    const cleanProfile = await cached.fetchProfile(playerUuid, profileUuid)

    const member = cleanProfile.members.find(m => m.uuid === playerUuid)

    return {
        member: {
            profileName: cleanProfile.name,
            first_join: member.first_join,
            last_save: member.last_save,

            // add all other data relating to the hypixel player, such as username, rank, etc
            ...player
        },
        profile: {
            minions: cleanProfile.minions
        }
    }
}
