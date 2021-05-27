import { cleanCollections, Collection } from './collections'
import { cleanInventories, Inventories } from './inventory'
import { cleanFairySouls, FairySouls } from './fairysouls'
import { cleanObjectives, Objective } from './objectives'
import { CleanFullProfileBasicMembers } from './profile'
import { cleanProfileStats, StatItem } from './stats'
import { CleanMinion, cleanMinions } from './minions'
import { AccountCustomization } from '../../database'
import { cleanSlayers, SlayerData } from './slayers'
import { cleanVisitedZones, Zone } from './zones'
import { cleanSkills, Skill } from './skills'
import * as cached from '../../hypixelCached'
import * as constants from '../../constants'
import { Included } from '../../hypixel'
import { CleanPlayer } from '../player'
import { CleanRank } from '../rank'
import { Bank } from './bank'

export interface CleanBasicMember {
	uuid: string
	username: string
	last_save: number
	first_join: number
	rank: CleanRank
}

export interface CleanMember extends CleanBasicMember {
	purse: number
	stats: StatItem[]
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
	const inventoriesIncluded = included === null || included.includes('inventories')
	const player = await cached.fetchPlayer(member.uuid)
	if (!player) return

	const fairySouls = cleanFairySouls(member)
	const { max_fairy_souls: maxFairySouls } = await constants.fetchConstantValues()
	if (fairySouls.total > (maxFairySouls ?? 0))
		await constants.setConstantValues({ max_fairy_souls: fairySouls.total })

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

		minions: await cleanMinions(member),
		fairy_souls: fairySouls,
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
	purse?: number
	stats?: StatItem[]
	rawHypixelStats?: { [ key: string ]: number }
	minions?: CleanMinion[]
	fairy_souls?: FairySouls
	inventories?: Inventories
	objectives?: Objective[]
	skills?: Skill[]
	visited_zones?: Zone[]
	collections?: Collection[]
	slayers?: SlayerData
}

export interface CleanMemberProfile {
	member: CleanMemberProfilePlayer
	profile: CleanFullProfileBasicMembers
	customization: AccountCustomization
}
