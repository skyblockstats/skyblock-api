import typedHypixelApi from 'typed-hypixel-api'
import * as constants from '../../constants.js'


const SLAYER_NAMES = {
	spider: 'tarantula',
	zombie: 'revenant',
	wolf: 'sven',
	enderman: 'voidgloom_seraph',
	blaze: 'inferno_demonlord'
} as const

// todo: put this in skyblock-constants since it can be determined from other people's profiles
export const SLAYER_TIERS: Record<keyof typeof SLAYER_NAMES, number> = {
	spider: 4,
	zombie: 5,
	enderman: 4,
	wolf: 4,
	blaze: 4
}

type SlayerName = (typeof SLAYER_NAMES)[keyof typeof SLAYER_NAMES]

interface SlayerTier {
	tier: number,
	kills: number
}

export interface Slayer {
	name?: SlayerName
	rawName: string
	xp: number
	level: number
	kills: number
	tiers: SlayerTier[]
}

export interface SlayerData {
	xp: number
	kills: number
	bosses: Slayer[]
}

export function cleanSlayers(data: typedHypixelApi.SkyBlockProfileMember): SlayerData {
	const slayers: Slayer[] = []

	const slayersDataRaw = data?.slayer_bosses

	let totalXp: number = 0
	let totalKills: number = 0

	let slayerIds: string[] = []

	for (const slayerNameRaw in slayersDataRaw) {
		slayerIds.push(slayerNameRaw)
		const slayerDataRaw = slayersDataRaw[slayerNameRaw]

		// convert name provided by api (spider) to the real name (tarantula)
		const slayerName: SlayerName = SLAYER_NAMES[slayerNameRaw]

		const slayerXp: number = slayerDataRaw.xp ?? 0
		let slayerKills: number = 0
		const slayerTiers: SlayerTier[] = []

		// we get the level by finding the biggest number in "level_<number>"
		let slayerLevel = slayerDataRaw.claimed_levels ? (Object.keys(slayerDataRaw.claimed_levels)
			.filter(k => slayerDataRaw.claimed_levels[k])
			.map(n => parseInt(n.replace(/^level_/, '')))
			.sort((a, b) => b - a)[0] ?? 0) : 0


		for (const slayerDataKey in slayerDataRaw) {
			// if a key starts with boss_kills_tier_ (boss_kills_tier_1), get the last number
			if (slayerDataKey.startsWith('boss_kills_tier_')) {
				const slayerTierRaw = parseInt(slayerDataKey.slice('boss_kills_tier_'.length))
				const slayerTierKills = slayerDataRaw[slayerDataKey] ?? 0
				// add 1 since hypixel is using 0 indexed tiers
				const slayerTier = slayerTierRaw + 1
				slayerTiers.push({
					kills: slayerTierKills,
					tier: slayerTier
				})

				// count up the total number of kills for this slayer
				if (slayerTierKills)
					slayerKills += slayerTierKills
			}
		}

		// if the slayer tier length is less than the max, add more empty ones
		while (slayerTiers.length < SLAYER_TIERS[slayerName])
			slayerTiers.push({
				tier: slayerTiers.length + 1,
				kills: 0
			})

		const slayer: Slayer = {
			name: slayerName,
			rawName: slayerNameRaw,
			tiers: slayerTiers,
			xp: slayerXp ?? 0,
			level: slayerLevel,
			kills: slayerKills
		}

		slayers.push(slayer)

		// add the xp and kills from this slayer to the total xp
		if (slayerXp)
			totalXp += slayerXp
		if (slayerKills)
			totalKills += slayerKills
	}

	constants.addSlayers(slayerIds)

	return {
		xp: totalXp,
		kills: totalKills,
		bosses: slayers
	}
}

