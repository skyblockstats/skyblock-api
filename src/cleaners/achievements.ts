import typedHypixelApi from 'typed-hypixel-api'
import { fetchAchievements } from '../hypixelCached.js'

interface TieredAchievement {
	id: string
	name: string
	tier: number
	amount: number
	/**
	 * The amount that has to be gotten to get to the next tier. If this is
	 * null, that means the player is at the max tier.
	 */
	next: number | null
	description: string
}

interface ChallengeAchievement {
	id: string
	name: string
	unlocked: boolean
	description: string
}

export interface Achievements {
	tiered: TieredAchievement[]
	challenge: ChallengeAchievement[]
}

export async function cleanPlayerAchievements(data: typedHypixelApi.PlayerDataResponse['player']): Promise<Achievements> {
	if (!data.achievements) {
		return { tiered: [], challenge: [] }
	}

	const gameAchievements: typedHypixelApi.AchievementsResponse['achievements'] = await fetchAchievements()

	for (const [gameId, achievementsData] of Object.entries(gameAchievements)) {
		if (gameId !== 'skyblock') continue


		let tieredAchievements: TieredAchievement[] = []
		for (const [achievementId, achievementData] of Object.entries(achievementsData.tiered)) {
			const amount = data.achievements[`skyblock_${achievementId.toLowerCase()}`] ?? 0

			let tier = 0
			for (const tierData of achievementData.tiers) {
				if (amount >= tierData.amount)
					tier = tierData.tier
				else
					break
			}
			const next = achievementData.tiers[tier]?.amount ?? null

			tieredAchievements.push({
				id: achievementId.toLowerCase(),
				name: achievementData.name,
				tier,
				next,
				amount,
				description: achievementData.description.replace(/%s/g, (achievementData.tiers[Math.max(0, tier - 1)].amount).toString())
			})
		}
		tieredAchievements.sort((a, b) => (b.amount ?? 0) - (a.amount ?? 0))

		let unlockedChallengeAchievements: ChallengeAchievement[] = []
		let lockedChallengeAchievements: ChallengeAchievement[] = []

		for (const [achievementId, achievementData] of Object.entries(achievementsData.one_time)) {
			const achievement: ChallengeAchievement = {
				id: achievementId.toLowerCase(),
				name: achievementData.name,
				unlocked: data.achievementsOneTime.includes(`skyblock_${achievementId.toLowerCase()}`),
				description: achievementData.description
			}
			if (achievement.unlocked)
				unlockedChallengeAchievements.push(achievement)
			else
				lockedChallengeAchievements.push(achievement)
		}

		// temporarily disabled
		return { tiered: [], challenge: [] }
		return {
			tiered: tieredAchievements,
			challenge: [
				...unlockedChallengeAchievements,
				...lockedChallengeAchievements
			]
		}
	}

	// this shouldn't be possible
	console.debug('skyblock not found in achievements?')
	return { tiered: [], challenge: [] }
}
