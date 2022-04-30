import typedHypixelApi from 'typed-hypixel-api'

export interface Achievements {
	skyblock: Record<string, number>
}

export function cleanPlayerAchievements(data: typedHypixelApi.PlayerDataResponse['player']): Achievements {
	const achievements: Achievements = {
		skyblock: {}
	}

	for (const [id, value] of Object.entries(data.achievements)) {
		if (id.startsWith('skyblock_'))
			achievements.skyblock[id.substring(9)] = value
	}

	return achievements
}
