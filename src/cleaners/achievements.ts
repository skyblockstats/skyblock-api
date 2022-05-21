import typedHypixelApi from 'typed-hypixel-api'
import { fetchAchievements } from '../hypixelCached.js'

interface TieredAchievement {
	id: string
	name: string
	value: number | null
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
	const gameAchievements: typedHypixelApi.AchievementsResponse['achievements'] = await fetchAchievements()

	for (const [gameId, achievementsData] of Object.entries(gameAchievements)) {
		if (gameId !== 'skyblock') continue


		let tieredAchievements: TieredAchievement[] = []
		for (const [achievementId, achievementData] of Object.entries(achievementsData.tiered)) {
			const value = data.achievements[`skyblock_${achievementId.toLowerCase()}`] ?? null
			tieredAchievements.push({
				id: achievementId.toLowerCase(),
				name: achievementData.name,
				value,
				description: value ? achievementData.description.replace(/%s/g, value.toString()) : achievementData.description
			})
		}
		tieredAchievements.sort((a, b) => (b.value ?? 0) - (a.value ?? 0))

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

		return {
			tiered: tieredAchievements, challenge: [
				...unlockedChallengeAchievements,
				...lockedChallengeAchievements
			]
		}
	}

	// this shouldn't be possible
	console.debug('skyblock not found in achievements?')
	return { tiered: [], challenge: [] }
}
