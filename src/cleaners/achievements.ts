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
	achieved: boolean
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

		let challengeAchievements: ChallengeAchievement[] = []
		for (const [achievementId, achievementData] of Object.entries(achievementsData.one_time)) {
			challengeAchievements.push({
				id: achievementId.toLowerCase(),
				name: achievementData.name,
				achieved: data.achievementsOneTime.includes(`skyblock_${achievementId.toLowerCase()}`),
				description: achievementData.description
			})
		}

		return { tiered: tieredAchievements, challenge: challengeAchievements }
	}

	// this shouldn't be possible
	console.debug('skyblock not found in achievements?')
	return { tiered: [], challenge: [] }
}
