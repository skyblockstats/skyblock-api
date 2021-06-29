import { colorCodeFromName, minecraftColorCodes } from '../util'
import { HypixelPlayer } from '../hypixelApi'

const rankColors: { [ name: string ]: string } = {
	'NONE': '7',
	'VIP': 'a',
	'VIP+': 'a',
	'MVP': 'b',
	'MVP+': 'b',
	'MVP++': '6',
	'YOUTUBE': 'c',
	'HELPER': '9',
	'MOD': '2',
	'GM': '2',
	'ADMIN': 'c'
}

export interface CleanRank {
	name: string,
	color: string | null,
	colored: string | null,
}

/** Response cleaning (reformatting to be nicer) */
export function cleanRank({
	packageRank,
	newPackageRank,
	monthlyPackageRank,
	rankPlusColor,
	rank,
	prefix
}: HypixelPlayer): CleanRank {
	let name
	let color
	let colored
	if (prefix) { // derive values from prefix
		colored = prefix
		color = minecraftColorCodes[colored.match(/§./)[0][1]]
		name = colored.replace(/§./g, '').replace(/[\[\]]/g, '')
	} else {
		if (monthlyPackageRank && monthlyPackageRank !== 'NONE')
			name = monthlyPackageRank
		else if (rank && rank !== 'NORMAL')
			name = rank
		else
			name = newPackageRank?.replace('_PLUS', '+')
				?? packageRank?.replace('_PLUS', '+')

		switch (name) {
   		// MVP++ is called Superstar for some reason
			case 'SUPERSTAR':
				name = 'MVP++'
				break
			// YouTube rank is called YouTuber, change this to the proper name
			case 'YOUTUBER':
				name = 'YOUTUBE'
				break
			case 'GAME_MASTER':
				name = 'GM'
				break
			case 'MODERATOR':
				name = 'MOD'
				break
			case undefined:
				name = 'NONE'
				break
		}

		const plusColor = rankPlusColor ? colorCodeFromName(rankPlusColor) : null
		color = minecraftColorCodes[rankColors[name]]
		const rankColorPrefix = rankColors[name] ? '§' + rankColors[name] : ''
		const nameWithoutPlus = name.split('+')[0]
		const plusesInName = '+'.repeat(name.split('+').length - 1)
		if (plusColor && plusesInName.length >= 1)
			colored = `${rankColorPrefix}[${nameWithoutPlus}§${plusColor}${plusesInName}${rankColorPrefix}]`
		else if (name !== 'NONE')
			colored = `${rankColorPrefix}[${name}]`
		else
			// nons don't have a prefix
			colored = `${rankColorPrefix}`
	}
	return {
		name,
		color,
		colored
	}
}
