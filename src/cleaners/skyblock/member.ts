import { Included } from '../../hypixel'
import * as cached from '../../hypixelCached'
import { CleanPlayer } from '../player'
import { CleanMinion, cleanMinions } from './minions'
import { CleanProfileStats, cleanProfileStats } from './stats'

export interface CleanBasicMember {
    uuid: string
    username: string
    last_save: number
    first_join: number
}

export interface CleanMember extends CleanBasicMember {
    stats?: CleanProfileStats
    minions?: CleanMinion[]
}


/** Cleans up a member (from skyblock/profile) */
export async function cleanSkyBlockProfileMemberResponse(member, included: Included[] = null): Promise<CleanMember> {
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
