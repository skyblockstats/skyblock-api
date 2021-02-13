import { CleanBasicMember, CleanMember, CleanMemberProfile, cleanSkyBlockProfileMemberResponse } from './member'
import { CleanMinion, combineMinionArrays } from './minions'
import * as cached from '../../hypixelCached'
import { cleanBank } from './bank'

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
export async function cleanSkyblockProfileResponseLighter(data): Promise<CleanProfile> {
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

/** This function is somewhat costly and shouldn't be called often. Use cleanSkyblockProfileResponseLighter if you don't need all the data */
export async function cleanSkyblockProfileResponse(data: any): Promise<CleanFullProfile> {
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
        bank: cleanBank(data),
        minions
    }
}

/** A basic profile that only includes the profile uuid and name */
export interface CleanBasicProfile {
    uuid: string

    // the name depends on the user, so its sometimes not included
    name?: string
}

// TODO: this should be moved and split up
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
			uuid: cleanProfile.uuid,
			bank: cleanProfile.bank,
            minions: cleanProfile.minions,
        }
    }
}
