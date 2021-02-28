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
	'MODERATOR': '2',
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
		else
			name = rank
				?? newPackageRank?.replace('_PLUS', '+')
				?? packageRank?.replace('_PLUS', '+')

		// MVP++ is called Superstar for some reason
		if (name === 'SUPERSTAR') name = 'MVP++'
		// YouTube rank is called YouTuber, change this to the proper name
		else if (name === 'YOUTUBER') name = 'YOUTUBE'
		else if (name === undefined) name = 'NONE'

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
