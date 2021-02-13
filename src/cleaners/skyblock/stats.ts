const statCategories: { [ key: string ]: string[] | null } = { // sorted in order of importance
    'deaths': ['deaths_', 'deaths'],
    'kills': ['kills_', 'kills'],
    'fishing': ['items_fished_', 'items_fished'],
    'auctions': ['auctions_'],
    'races': ['_best_time'],
    'misc': null // everything else goes here
}

interface statCategory {
	category: string,
	name: string
}

function categorizeStat(statNameRaw: string): statCategory {
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
            let trailingEnd = categoryMatch[0] == '_'
            let trailingStart = categoryMatch.substr(-1) == '_'
            if (trailingStart && statNameRaw.startsWith(categoryMatch)) {
                return {
                    category: statCategory,
                    name: statNameRaw.substr(categoryMatch.length)
                }
            } else if (trailingEnd && statNameRaw.endsWith(categoryMatch)) {
                return {
                    category: statCategory,
                    name: statNameRaw.substr(0, categoryMatch.length)
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

export interface CleanProfileStats {
    [ category: string ]: {
        [ stat: string ]: any
        total?: any
    }
}

export function cleanProfileStats(statsRaw): CleanProfileStats {
    // TODO: add type for statsRaw (probably in hypixelApi.ts since its coming from there)
    const stats: CleanProfileStats = {}
    for (let statNameRaw in statsRaw) {
        let { category: statCategory, name: statName } = categorizeStat(statNameRaw)
        if (!stats[statCategory]) stats[statCategory] = {}
        stats[statCategory][statName || 'total'] = statsRaw[statNameRaw]
    }
    return stats
}
