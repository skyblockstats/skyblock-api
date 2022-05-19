import typedHypixelApi from 'typed-hypixel-api'
import { fetchAchievements } from '../hypixelCached.js'

interface TieredAchievement {
	id: string
	name: string
	value?: number
	description: string
}

interface OneTimeAchievement {
	id: string
	name: string
	achieved: boolean
	description: string
}

export interface Achievements {
	tiered: TieredAchievement[]
	oneTime: OneTimeAchievement[]
}

export async function cleanPlayerAchievements(data: typedHypixelApi.PlayerDataResponse['player']): Promise<Achievements> {
	const gameAchievements: typedHypixelApi.AchievementsResponse['achievements'] = await fetchAchievements()

	for (const [gameId, achievementsData] of Object.entries(gameAchievements)) {
		if (gameId !== 'skyblock') continue


		let tieredAchievements: TieredAchievement[] = []
		for (const [achievementId, achievementData] of Object.entries(achievementsData.tiered)) {
			const value = data.achievements[`skyblock_${achievementId}`] ?? undefined
			tieredAchievements.push({
				id: achievementId.toLowerCase(),
				name: achievementData.name,
				value,
				description: value ? achievementData.description.replace(/%s/g, value.toString()) : achievementData.description
			})
		}

		let oneTimeAchievements: OneTimeAchievement[] = []
		for (const [achievementId, achievementData] of Object.entries(achievementsData.one_time)) {
			oneTimeAchievements.push({
				id: achievementId.toLowerCase(),
				name: achievementData.name,
				achieved: data.achievementsOneTime.includes(`skyblock_${achievementId}`),
				description: achievementData.description
			})
		}

		return { tiered: tieredAchievements, oneTime: oneTimeAchievements }
	}

	// this shouldn't be possible
	console.debug('skyblock not found in achievements?')
	return { tiered: [], oneTime: [] }
}
