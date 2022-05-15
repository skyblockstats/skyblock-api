import { cleanFarmingContests, FarmingContests } from './farmingContents.js'
import { cleanCoopInvitation, CoopInvitation } from './coopInvitation.js'
import { cleanCollections, Collection } from './collections.js'
import { cleanInventories, Inventories } from './inventory.js'
import { cleanFairySouls, FairySouls } from './fairysouls.js'
import { cleanObjectives, Objective } from './objectives.js'
import { CleanFullProfileBasicMembers } from './profile.js'
import { cleanProfileStats, StatItem } from './stats.js'
import { CleanMinion, cleanMinions } from './minions.js'
import { cleanSlayers, SlayerData } from './slayers.js'
import { AccountCustomization } from '../../database.js'
import { cleanVisitedZones, Zone } from './zones.js'
import { cleanSkills, Skills } from './skills.js'
import * as cached from '../../hypixelCached.js'
import typedHypixelApi from 'typed-hypixel-api'
import { cleanPets, PetsData } from './pets.js'
import { cleanHarp, HarpData } from './harp.js'
import * as constants from '../../constants.js'
import { Included } from '../../hypixel.js'
import { CleanPlayer } from '../player.js'
import { CleanRank } from '../rank.js'
import { AccessoryBagUpgrades, cleanAccessoryBagUpgrades } from './accessoryBagUpgrades.js'

export interface CleanBasicMember {
	uuid: string
	username: string
	lastSave: number | null
	firstJoin: number | null
	rank: CleanRank
	left?: boolean
}

export interface CleanMember extends CleanBasicMember {
	purse: number
	stats: StatItem[]
	rawHypixelStats: { [key: string]: number }
	minions: CleanMinion[]
	fairySouls: FairySouls
	inventories?: Inventories
	objectives: Objective[]
	skills: Skills
	zones: Zone[]
	collections: Collection[]
	slayers: SlayerData
	pets: PetsData
	harp: HarpData
	coopInvitation: CoopInvitation | null
	farmingContests: FarmingContests
	accessoryBagUpgrades: AccessoryBagUpgrades
	/** Whether the user left the coop */
	left: boolean
}

export async function cleanSkyBlockProfileMemberResponseBasic(member: typedHypixelApi.SkyBlockProfileMember & { uuid: string }): Promise<CleanBasicMember | null> {
	const player = await cached.fetchPlayer(member.uuid, false)
	if (!player) return null
	return {
		uuid: member.uuid,
		username: player.username,
		lastSave: member.last_save ?? null,
		firstJoin: member.first_join ?? null,
		rank: player.rank
	}
}

/** Cleans up a member (from skyblock/profile) */
export async function cleanSkyBlockProfileMemberResponse(member: typedHypixelApi.SkyBlockProfileMember & { uuid: string }, profileId?: string, included: Included[] | undefined = undefined): Promise<CleanMember | null> {
	const inventoriesIncluded = included === undefined || included.includes('inventories')
	const player = await cached.fetchPlayer(member.uuid, true)
	if (!player) return null

	const fairySouls = await cleanFairySouls(member)
	const { max_fairy_souls: maxFairySouls } = await constants.fetchConstantValues()
	if (fairySouls.total > (maxFairySouls ?? 0))
		await constants.setConstantValues({ max_fairy_souls: fairySouls.total })

	const coopInvitationPromise = cleanCoopInvitation(member, member.uuid)
	const minionsPromise = cleanMinions(member)
	const skillsPromise = cleanSkills(member, player)
	const zonesPromise = cleanVisitedZones(member)
	const petsPromise = cleanPets(member)
	const harpPromise = cleanHarp(member)
	const inventoriesPromise = inventoriesIncluded ? cleanInventories(member) : Promise.resolve(undefined)
	const farmingContestsPromise = cleanFarmingContests(member)

	return {
		uuid: member.uuid,
		username: player.username,
		// members that haven't joined the profile have no last save or first join
		lastSave: member.last_save ?? null,
		firstJoin: member.first_join ?? null,
		rank: player.rank,

		purse: member.coin_purse ?? 0,

		stats: cleanProfileStats(member),

		// this is used for leaderboards
		rawHypixelStats: member.stats ?? {},

		minions: await minionsPromise,
		fairySouls: fairySouls,
		inventories: inventoriesPromise ? await inventoriesPromise : undefined,
		objectives: cleanObjectives(member),

		skills: await skillsPromise,

		zones: await zonesPromise,
		collections: cleanCollections(member),
		slayers: cleanSlayers(member),
		pets: await petsPromise,
		harp: await harpPromise,
		coopInvitation: await coopInvitationPromise,
		farmingContests: await farmingContestsPromise,
		accessoryBagUpgrades: cleanAccessoryBagUpgrades(member),

		left: (player.profiles?.find(profile => profile.uuid === profileId) === undefined) ?? false
	}
}


export interface CleanMemberProfilePlayer extends CleanPlayer {
	// The profile name may be different for each player, so we put it here
	profileName: string
	firstJoin: number | null
	lastSave: number | null
	purse: number
	stats: StatItem[]
	rawHypixelStats: { [key: string]: number }
	minions: CleanMinion[]
	fairySouls: FairySouls
	inventories?: Inventories
	objectives: Objective[]
	skills: Skills
	zones: Zone[]
	collections: Collection[]
	slayers: SlayerData
	pets: PetsData
	harp: HarpData
	coopInvitation: CoopInvitation | null
	farmingContests: FarmingContests
	accessoryBagUpgrades: AccessoryBagUpgrades
	left: boolean
}

export interface CleanMemberProfile {
	member: CleanMemberProfilePlayer
	profile: CleanFullProfileBasicMembers
	customization?: AccountCustomization
}
