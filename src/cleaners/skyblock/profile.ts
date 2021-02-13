import { CleanBasicMember, CleanMember, CleanMemberProfile, cleanSkyBlockProfileMemberResponse } from './member'
import { CleanMinion, combineMinionArrays, countUniqueMinions } from './minions'
import * as cached from '../../hypixelCached'
import { Bank, cleanBank } from './bank'
import { cleanFairySouls, FairySouls } from './fairysouls'

export interface CleanProfile extends CleanBasicProfile {
    members?: CleanBasicMember[]
}

export interface CleanFullProfile extends CleanProfile {
    members: CleanMember[]
    bank: Bank
    minions: CleanMinion[]
	minion_count: number
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
        minions: minions,
		minion_count: countUniqueMinions(minions)
    }
}

/** A basic profile that only includes the profile uuid and name */
export interface CleanBasicProfile {
    uuid: string

    // the name depends on the user, so its sometimes not included
    name?: string
}

