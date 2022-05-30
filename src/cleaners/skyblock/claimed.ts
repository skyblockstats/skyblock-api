import typedHypixelApi from 'typed-hypixel-api'
import { ClaimedSkyBlockItem } from '../player.js'

export function cleanPlayerSkyblockClaimed(data: typedHypixelApi.PlayerDataResponse['player']): ClaimedSkyBlockItem[] {
	const claimedItems: ClaimedSkyBlockItem[] = []

	// `name` is kept for backwards compatibility, it will be changed to a
	// more human readable name later!

	if (data.claimed_potato_talisman)
		claimedItems.push({
			id: 'potato_talisman',
			name: 'potato_talisman',
			timestamp: data.claimed_potato_talisman
		})
	if (data.claim_potato_war_crown)
		claimedItems.push({
			id: 'potato_crown',
			name: 'potato_crown',
			timestamp: data.claim_potato_war_crown
		})
	if (data.claimed_potato_basket)
		claimedItems.push({
			id: 'potato_basket',
			name: 'potato_basket',
			timestamp: data.claimed_potato_basket
		})
	if (data.claimed_year143_cake)
		claimedItems.push({
			id: 'year_143_cake',
			name: 'year_143_cake',
			timestamp: data.claimed_year143_cake
		})
	if (data.skyblock_free_cookie)
		claimedItems.push({
			id: 'free_booster_cookie',
			name: 'free_booster_cookie',
			timestamp: data.skyblock_free_cookie
		})

	const centuryCakes = Object.keys(data).filter((key) => key.startsWith('claimed_century_cake'))
	for (const centuryCake of centuryCakes) {
		const centuryCakeYear = centuryCake === 'claimed_century_cake' ? '100' : centuryCake.slice('claimed_century_cake'.length)
		claimedItems.push({
			id: `year_${centuryCakeYear}_century_cake`,
			name: `year_${centuryCakeYear}_century_cake`,
			timestamp: data[centuryCake]
		})
	}

	const scorpiusBribes = Object.keys(data).filter((key) => key.startsWith('scorpius_bribe_'))
	for (const bribe of scorpiusBribes) {
		const bribeYear = bribe.slice('scorpius_bribe_'.length)
		claimedItems.push({
			id: `year_${bribeYear}_scorpius_bribe`,
			name: `year_${bribeYear}_scorpius_bribe`,
			timestamp: data[bribe]
		})
	}

	claimedItems.sort((a, b) => a.timestamp - b.timestamp)

	return claimedItems
}
