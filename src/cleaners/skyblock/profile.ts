import { CleanBasicMember, CleanMember, cleanSkyBlockProfileMemberResponse, cleanSkyBlockProfileMemberResponseBasic } from './member.js'
import { CleanMinion, combineMinionArrays, countUniqueMinions } from './minions.js'
import typedHypixelApi from 'typed-hypixel-api'
import * as constants from '../../constants.js'
import { ApiOptions } from '../../hypixel.js'
import { Bank, cleanBank } from './bank.js'
import { cleanGameMode, GameMode } from './gameMode.js'

export interface CleanProfile extends CleanBasicProfile {
    members: CleanBasicMember[]
    mode: GameMode
}

export interface CleanFullProfile extends CleanProfile {
    members: CleanMember[]
    bank: Bank
    minions: CleanMinion[]
    minionCount: number
    maxUniqueMinions: number
}

export interface CleanFullProfileBasicMembers extends CleanProfile {
    members: CleanBasicMember[]
    bank: Bank
    minions: CleanMinion[]
    minionCount: number
    maxUniqueMinions: number
}

/** Return a `CleanProfile` instead of a `CleanFullProfile`, useful when we need to get members but don't want to waste much ram */
export async function cleanSkyblockProfileResponseLighter(data: typedHypixelApi.SkyBlockProfile | typedHypixelApi.SkyBlockProfilesResponse['profiles'][number]): Promise<CleanProfile> {
    // We use Promise.all so it can fetch all the usernames at once instead of waiting for the previous promise to complete
    const promises: Promise<CleanBasicMember | null>[] = []

    for (const memberUUID in data.members) {
        const memberRaw = data.members[memberUUID]
        const memberRawWithUuid = { ...memberRaw, uuid: memberUUID }
        // we pass an empty array to make it not check stats
        promises.push(cleanSkyBlockProfileMemberResponseBasic(memberRawWithUuid))
    }

    const cleanedMembers: CleanBasicMember[] = (await Promise.all(promises)).filter(m => m) as CleanBasicMember[]

    return {
        uuid: data.profile_id.replace(/-/g, ''),
        name: 'cute_name' in data ? data.cute_name : undefined,
        members: cleanedMembers,
        mode: cleanGameMode(data)
    }
}

/**
 * This function is somewhat costly and shouldn't be called often. Use cleanSkyblockProfileResponseLighter if you don't need all the data
 */
export async function cleanSkyblockProfileResponse<O extends ApiOptions>(
    data: typedHypixelApi.SkyBlockProfile | typedHypixelApi.SkyBlockProfilesResponse['profiles'][number],
    options?: O
): Promise<(O['basic'] extends true ? CleanProfile : CleanFullProfile) | null> {
    // We use Promise.all so it can fetch all the users at once instead of waiting for the previous promise to complete
    const promises: Promise<CleanMember | null>[] = []
    if (!data) return null

    const profileId = data.profile_id.replace(/-/g, '')

    for (const memberUUID in data.members) {
        const memberRaw = data.members[memberUUID]
        const memberRawWithUuid = { ...memberRaw, uuid: memberUUID }
        promises.push(cleanSkyBlockProfileMemberResponse(
            memberRawWithUuid,
            profileId,
            [
                !options?.basic ? 'stats' : undefined,
                options?.mainMemberUuid === memberUUID ? 'inventories' : undefined
            ]
        ))
    }


    const cleanedMembers: CleanMember[] = (await Promise.all(promises)).filter(m => m) as CleanMember[]

    // sometimes it's ms since epoch and sometimes it's a string, so we
    // just throw it into new Date() and js will figure it out for us
    const lastSave = data.last_save ? (new Date(data.last_save).getTime()) : undefined
    // also set the lastSave in the member if options.mainMemberUuid matches
    if (options?.mainMemberUuid) {
        const mainMember = cleanedMembers.find(m => m.uuid === options.mainMemberUuid)
        if (mainMember) mainMember.lastSave = lastSave ?? null
    }

    if (options?.basic) {
        const cleanProfile: CleanProfile = {
            uuid: profileId,
            name: 'cute_name' in data ? data.cute_name : undefined,
            members: cleanedMembers,
            mode: cleanGameMode(data),
            lastSave
        }
        // we have to do this because of the basic checking typing
        return cleanProfile as any
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
    const cleanFullProfile: CleanFullProfile = {
        uuid: data.profile_id.replace(/-/g, ''),
        name: 'cute_name' in data ? data.cute_name : undefined,
        members: cleanedMembers,
        bank: cleanBank(data),
        minions: minions,
        minionCount: uniqueMinions,
        maxUniqueMinions: maxUniqueMinions ?? 0,
        mode: cleanGameMode(data),
        lastSave
    }
    return cleanFullProfile
}

/** A basic profile that only includes the profile uuid and name */
export interface CleanBasicProfile {
    uuid: string

    // the name depends on the user, so its sometimes not included
    name?: string

    /** Timestamp for when the profile was last saved for the user. */
    lastSave?: number
}

