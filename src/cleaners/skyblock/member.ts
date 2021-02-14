import { Included } from '../../hypixel'
import * as cached from '../../hypixelCached'
import { CleanPlayer } from '../player'
import { Bank } from './bank'
import { cleanFairySouls, FairySouls } from './fairysouls'
import { cleanInventories, INVENTORIES } from './inventory'
import { CleanMinion, cleanMinions } from './minions'
import { cleanObjectives, Objective } from './objectives'
import { CleanFullProfile } from './profile'
import { CleanProfileStats, cleanProfileStats } from './stats'

export interface CleanBasicMember {
    uuid: string
    username: string
    last_save: number
    first_join: number
}

export interface CleanMember extends CleanBasicMember {
    stats: CleanProfileStats
    minions: CleanMinion[]
	fairy_souls: FairySouls
    inventories: typeof INVENTORIES
    objectives: Objective[]
}

export async function cleanSkyBlockProfileMemberResponseBasic(member, included: Included[] = null): Promise<CleanBasicMember> {
    return {
        uuid: member.uuid,
        username: await cached.usernameFromUser(member.uuid),
        last_save: member.last_save,
        first_join: member.first_join,
    }
}

/** Cleans up a member (from skyblock/profile) */
export async function cleanSkyBlockProfileMemberResponse(member, included: Included[] = null): Promise<CleanMember> {
    // profiles.members[]
    const inventoriesIncluded = included == null || included.includes('inventories')
    return {
        uuid: member.uuid,
        username: await cached.usernameFromUser(member.uuid),
        last_save: member.last_save,
        first_join: member.first_join,

        stats: cleanProfileStats(member),
        minions: cleanMinions(member),
        fairy_souls: cleanFairySouls(member),
        inventories: inventoriesIncluded ? await cleanInventories(member) : undefined,
        objectives: cleanObjectives(member),
        // skills: statsIncluded ? 
    }
}


export interface CleanMemberProfilePlayer extends CleanPlayer {
    // The profile name may be different for each player, so we put it here
    profileName: string
    first_join: number
    last_save: number
    bank?: Bank
}

export interface CleanMemberProfile {
    member: CleanMemberProfilePlayer
    profile: CleanFullProfile
}
