const statCategories: { [ key: string ]: string[] | null } = { // sorted in order of importance
	'deaths': ['deaths_', 'deaths'],
	'kills': ['kills_', 'kills'],
	'fishing': ['items_fished_', 'items_fished', 'shredder_'],
	'auctions': ['auctions_'],
	'races': ['_best_time', '_best_time_2'],
	'mythos': ['mythos_burrows_', 'mythos_kills'],

	'collection': ['collection_'],
	'skills': ['skill_'],
	'slayer': ['slayer_'],

	'misc': null // everything else goes here
}

export interface StatCategory {
	category: string | null
	name: string | null
}

export function categorizeStat(statNameRaw: string): StatCategory {
	// 'deaths_void'
	for (const statCategory in statCategories) {
		// 'deaths'
		const statCategoryMatchers = statCategories[statCategory]
		if (statCategoryMatchers == null) {
			// If it's null, just go with this. Can only ever be 'misc'
			return {
				category: statCategory,
				name: statNameRaw
			}
		}
		for (const categoryMatch of statCategoryMatchers) {
			// ['deaths_']
			let trailingEnd = categoryMatch[0] === '_'
			let trailingStart = categoryMatch.substr(-1) === '_'
			if (trailingStart && statNameRaw.startsWith(categoryMatch)) {
				return {
					category: statCategory,
					name: statNameRaw.substr(categoryMatch.length)
				}
			} else if (trailingEnd && statNameRaw.endsWith(categoryMatch)) {
				return {
					category: statCategory,
					name: statNameRaw.substr(0, statNameRaw.length - categoryMatch.length)
				}
			} else if (statNameRaw == categoryMatch) {
				// if it matches exactly, we don't know the name. will be defaulted to category later on
				return {
					category: statCategory,
					name: null
				}
			}
		}
	}
	// this should never happen, as it'll default to misc and return if nothing is found
	return {
		category: null,
		name: statNameRaw
	}
}

export const statUnits = {
	time: ['_best_time', '_best_time_2'],
	date: ['first_join'],
	coins: ['purse'],
	leaderboards: ['leaderboards_count']
}

export interface StatItem {
	rawName: string
	value: number
	categorizedName: string
	category: string | null
	unit: string | null
}

export function getStatUnit(name: string): string | null {
	for (const [ unitName, statMatchers ] of Object.entries(statUnits)) {
		for (const statMatch of statMatchers) {
			let trailingEnd = statMatch[0] === '_'
			let trailingStart = statMatch.substr(-1) === '_'
			if (
				(trailingStart && name.startsWith(statMatch))
				|| (trailingEnd && name.endsWith(statMatch))
				|| (name == statMatch)
			)
				return unitName
		}
	}
	return null
}


export function cleanProfileStats(data: any): StatItem[] {
	// TODO: add type for statsRaw (probably in hypixelApi.ts since its coming from there)
	const stats: StatItem[] = []

	const rawStats = data?.stats ?? {}

	for (const statNameRaw in rawStats) {
		const statValue = rawStats[statNameRaw]
		let { category: statCategory, name: statName } = categorizeStat(statNameRaw)
		stats.push({
			categorizedName: statName ?? 'total',
			value: statValue,
			rawName: statNameRaw,
			category: statCategory,
			unit: getStatUnit(statNameRaw) ?? null
		})
	}

	return stats
}
