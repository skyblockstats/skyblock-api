import { CleanProfileStats, cleanProfileStats } from './stats'
import { cleanInventories, Inventories } from './inventory'
import { cleanFairySouls, FairySouls } from './fairysouls'
import { cleanObjectives, Objective } from './objectives'
import { CleanMinion, cleanMinions } from './minions'
import { cleanSkills, Skill } from './skills'
import * as cached from '../../hypixelCached'
import { CleanFullProfile, CleanFullProfileBasicMembers } from './profile'
import { Included } from '../../hypixel'
import { CleanPlayer } from '../player'
import { Bank } from './bank'
import { cleanVisitedZones, Zone } from './zones'
import { cleanCollections, Collection } from './collections'
import { cleanSlayers, SlayerData } from './slayers'
import { cleanRank, CleanRank } from '../rank'

export interface CleanBasicMember {
    uuid: string
    username: string
    last_save: number
    first_join: number
    rank: CleanRank
}

export interface CleanMember extends CleanBasicMember {
    purse: number
    stats: CleanProfileStats
    rawHypixelStats?: { [ key: string ]: number }
    minions: CleanMinion[]
	fairy_souls: FairySouls
    inventories: Inventories
    objectives: Objective[]
    skills: Skill[]
    visited_zones: Zone[]
    collections: Collection[]
    slayers: SlayerData
}

export async function cleanSkyBlockProfileMemberResponseBasic(member: any, included: Included[] = null): Promise<CleanBasicMember> {
    const player = await cached.fetchPlayer(member.uuid)
    return {
        uuid: member.uuid,
        username: player.username,
        last_save: member.last_save / 1000,
        first_join: member.first_join / 1000,
        rank: player.rank
    }
}

/** Cleans up a member (from skyblock/profile) */
export async function cleanSkyBlockProfileMemberResponse(member, included: Included[] = null): Promise<CleanMember> {
    // profiles.members[]
    const inventoriesIncluded = included == null || included.includes('inventories')
    const player = await cached.fetchPlayer(member.uuid)
    return {
        uuid: member.uuid,
        username: player.username,
        last_save: member.last_save / 1000,
        first_join: member.first_join / 1000,
        rank: player.rank,

        purse: member.coin_purse,

        stats: cleanProfileStats(member),

        // this is used for leaderboards
        rawHypixelStats: member.stats ?? {},

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
    profile: CleanFullProfileBasicMembers
}
