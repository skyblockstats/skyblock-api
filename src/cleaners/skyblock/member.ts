import { CleanProfileStats, cleanProfileStats } from './stats'
import { cleanInventories, Inventories } from './inventory'
import { cleanFairySouls, FairySouls } from './fairysouls'
import { cleanObjectives, Objective } from './objectives'
import { CleanMinion, cleanMinions } from './minions'
import { cleanSkills, Skill } from './skills'
import * as cached from '../../hypixelCached'
import { CleanFullProfile } from './profile'
import { Included } from '../../hypixel'
import { CleanPlayer } from '../player'
import { Bank } from './bank'
import { cleanVisitedZones, Zone } from './zones'
import { cleanCollections, Collection } from './collections'
import { cleanSlayers, Slayer } from './slayers'

export interface CleanBasicMember {
    uuid: string
    username: string
    last_save: number
    first_join: number
}

export interface CleanMember extends CleanBasicMember {
    purse: number
    stats: CleanProfileStats
    minions: CleanMinion[]
	fairy_souls: FairySouls
    inventories: Inventories
    objectives: Objective[]
    skills: Skill[]
    visited_zones: Zone[]
    collections: Collection[]
    slayers: Slayer[]
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

        purse: member.coin_purse,

        stats: cleanProfileStats(member),
        minions: cleanMinions(member),
        fairy_souls: cleanFairySouls(member),
        inventories: inventoriesIncluded ? await cleanInventories(member) : undefined,
        objectives: cleanObjectives(member),
        skills: cleanSkills(member),
        visited_zones: cleanVisitedZones(member),
        collections: cleanCollections(member),
        slayers: cleanSlayers(member)
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
