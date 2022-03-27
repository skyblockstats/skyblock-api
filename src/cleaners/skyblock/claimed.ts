import { HypixelPlayerStatsSkyBlockProfiles } from '../../hypixelApi.js'
import {
	CleanBasicProfile,
	CleanFullProfile,
	cleanSkyblockProfileResponse
} from './profile.js'
import typedHypixelApi from 'typed-hypixel-api'
import { ClaimedSkyBlockItem } from '../player.js'

export function cleanPlayerSkyblockClaimed(data: typedHypixelApi.PlayerDataResponse['player']): ClaimedSkyBlockItem[] {
	const claimedItems: ClaimedSkyBlockItem[] = []

	if (data.claimed_potato_talisman)
		claimedItems.push({
			name: 'potato_talisman',
			timestamp: data.claimed_potato_talisman
		})
	if (data.claimed_century_cake)
		claimedItems.push({
			name: 'century_cake',
			timestamp: data.claimed_century_cake
		})
	if (data.claimed_year143_cake)
		claimedItems.push({
			name: 'year_143_cake',
			timestamp: data.claimed_year143_cake
		})
	if (data.skyblock_free_cookie)
		claimedItems.push({
			name: 'free_booster_cookie',
			timestamp: data.skyblock_free_cookie
		})

	const scorpiusBribes = Object.keys(data).filter((key) => key.startsWith('scorpius_bribe_'))
	for (const bribe of scorpiusBribes) {
		const bribeYear = bribe.slice('scorpius_bribe_'.length)
		claimedItems.push({
			name: `year_${bribeYear}_scorpius_bribe`,
			timestamp: data[bribe]
		})
	}

	return claimedItems
}
