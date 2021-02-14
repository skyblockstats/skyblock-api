
const slayerLevels = 4 // number of slayer levels, this might be 5 soon

type SlayerName = 'spider' | 'zombie' | 'wolf'

interface SlayerTier {
	tier: number,
	kills: number
}

export interface Slayer {
	name: SlayerName
	xp: number
	tiers: SlayerTier[]
}

export function cleanSlayers(data: any) {
	const slayers: Slayer[] = []

	const slayersDataRaw = data?.slayer_bosses
	for (const slayerName in slayersDataRaw) {
		const slayerDataRaw = slayersDataRaw[slayerName]
		const slayerXp: number = slayerDataRaw.xp
		const slayerTiers: SlayerTier[] = []
		for (const slayerDataKey in slayerDataRaw) {
			// if a key starts with boss_kills_tier_ (boss_kills_tier_1), get the last number
			if (slayerDataKey.startsWith('boss_kills_tier_')) {
				const slayerTierRaw = parseInt(slayerDataKey.substr('boss_kills_tier_'.length))
				const slayerTierKills = slayerDataRaw[slayerDataKey]
				// add 1 since hypixel is using 0 indexed tiers
				const slayerTier = slayerTierRaw + 1
				slayerTiers.push({
					kills: slayerTierKills,
					tier: slayerTier
				})
			}
		}

		// if the slayer tier length is less than the max, add more empty ones
		while (slayerTiers.length < slayerLevels)
			slayerTiers.push({
				tier: slayerTiers.length + 1,
				kills: 0
			})

		const slayer: Slayer = {
			name: slayerName as SlayerName,
			tiers: slayerTiers,
			xp: slayerXp
		}
		slayers.push(slayer)
	}
	return slayers
}
