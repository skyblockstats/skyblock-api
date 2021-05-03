import { CleanBasicMember, CleanMember, cleanSkyBlockProfileMemberResponse, cleanSkyBlockProfileMemberResponseBasic } from './member'
import { CleanMinion, combineMinionArrays, countUniqueMinions } from './minions'
import { ApiOptions } from '../../hypixel'
import { Bank, cleanBank } from './bank'
import * as constants from '../../constants'

export interface CleanProfile extends CleanBasicProfile {
    members?: CleanBasicMember[]
}

export interface CleanFullProfile extends CleanProfile {
    members: CleanMember[]
    bank: Bank
    minions: CleanMinion[]
	minion_count: number
}

export interface CleanFullProfileBasicMembers extends CleanProfile {
    members: CleanBasicMember[]
    bank: Bank
    minions: CleanMinion[]
	minion_count: number
}

/** Return a `CleanProfile` instead of a `CleanFullProfile`, useful when we need to get members but don't want to waste much ram */
export async function cleanSkyblockProfileResponseLighter(data): Promise<CleanProfile> {
    // We use Promise.all so it can fetch all the usernames at once instead of waiting for the previous promise to complete
    const promises: Promise<CleanBasicMember>[] = []

    for (const memberUUID in data.members) {
        const memberRaw = data.members[memberUUID]
        memberRaw.uuid = memberUUID
        // we pass an empty array to make it not check stats
        promises.push(cleanSkyBlockProfileMemberResponseBasic(memberRaw))
    }

    const cleanedMembers: CleanBasicMember[] = await Promise.all(promises)

    return {
        uuid: data.profile_id,
        name: data.cute_name,
        members: cleanedMembers,
    }
}

/**
 * This function is somewhat costly and shouldn't be called often. Use cleanSkyblockProfileResponseLighter if you don't need all the data
 */
export async function cleanSkyblockProfileResponse(data: any, options?: ApiOptions): Promise<CleanFullProfile|CleanProfile> {
    // We use Promise.all so it can fetch all the users at once instead of waiting for the previous promise to complete
    const promises: Promise<CleanMember>[] = []
    
    for (const memberUUID in data.members) {
        const memberRaw = data.members[memberUUID]
        memberRaw.uuid = memberUUID
        promises.push(cleanSkyBlockProfileMemberResponse(
            memberRaw,
            [
                !options?.basic ? 'stats' : undefined,
                options?.mainMemberUuid === memberUUID ? 'inventories' : undefined
            ]
        ))
    }

    const cleanedMembers: CleanMember[] = (await Promise.all(promises)).filter(m => m !== null && m !== undefined)

    if (options?.basic) {
        return {
            uuid: data.profile_id,
            name: data.cute_name,
            members: cleanedMembers,
        }
    }

    const memberMinions: CleanMinion[][] = []

    for (const member of cleanedMembers) {
        memberMinions.push(member.minions)
    }
    const minions: CleanMinion[] = combineMinionArrays(memberMinions)

    const { max_minions: maxUniqueMinions } = await constants.fetchConstantValues()
    
    const uniqueMinions = countUniqueMinions(minions)
    if (uniqueMinions > (maxUniqueMinions ?? 0))
        await constants.setConstantValues({ max_minions: uniqueMinions })

    // return more detailed info
    return {
        uuid: data.profile_id,
        name: data.cute_name,
        members: cleanedMembers,
        bank: cleanBank(data),
        minions: minions,
		minion_count: uniqueMinions
    }
}

/** A basic profile that only includes the profile uuid and name */
export interface CleanBasicProfile {
    uuid: string

    // the name depends on the user, so its sometimes not included
    name?: string
}

