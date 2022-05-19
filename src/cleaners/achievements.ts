import typedHypixelApi from 'typed-hypixel-api'
import { fetchAchievements } from '../hypixelCached.js'

interface Achievement {
	id: string
	name: string
	value: number | boolean
	description: string
}

export interface Achievements {
	skyblock: Achievement[]
}

export async function cleanPlayerAchievements(data: typedHypixelApi.PlayerDataResponse['player']): Promise<Achievements> {
	const playerAchievements: Achievements = {
		skyblock: []
	}

	const gameAchievements: typedHypixelApi.AchievementsResponse['achievements'] = await fetchAchievements()

	for (const [gameId, achievementsData] of Object.entries(gameAchievements)) {
		if (gameId !== 'skyblock') continue

		let tieredAchievements: Achievement[] = []
		for (const [achievementId, achievementData] of Object.entries(achievementsData.tiered)) {
			const value = data.achievements[`skyblock_${achievementId}`] ?? 0
			tieredAchievements.push({
				id: achievementId.toLowerCase(),
				name: achievementData.name,
				value,
				description: achievementData.description.replace(/%s/g, value.toString())
			})
		}

		let oneTimeAchievements: Achievement[] = []
		for (const [achievementId, achievementData] of Object.entries(achievementsData.one_time)) {
			oneTimeAchievements.push({
				id: achievementId.toLowerCase(),
				name: achievementData.name,
				value: data.achievementsOneTime.includes(`skyblock_${achievementId}`),
				description: achievementData.description
			})
		}

		playerAchievements[gameId] = [...tieredAchievements, ...oneTimeAchievements]
	}

	return playerAchievements
}
