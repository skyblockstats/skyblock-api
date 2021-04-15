"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cleanProfileStats = exports.getStatUnit = exports.statUnits = exports.categorizeStat = void 0;
const statCategories = {
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
};
function categorizeStat(statNameRaw) {
    // 'deaths_void'
    for (const statCategory in statCategories) {
        // 'deaths'
        const statCategoryMatchers = statCategories[statCategory];
        if (statCategoryMatchers == null) {
            // If it's null, just go with this. Can only ever be 'misc'
            return {
                category: statCategory,
                name: statNameRaw
            };
        }
        for (const categoryMatch of statCategoryMatchers) {
            // ['deaths_']
            let trailingEnd = categoryMatch[0] === '_';
            let trailingStart = categoryMatch.substr(-1) === '_';
            if (trailingStart && statNameRaw.startsWith(categoryMatch)) {
                return {
                    category: statCategory,
                    name: statNameRaw.substr(categoryMatch.length)
                };
            }
            else if (trailingEnd && statNameRaw.endsWith(categoryMatch)) {
                return {
                    category: statCategory,
                    name: statNameRaw.substr(0, statNameRaw.length - categoryMatch.length)
                };
            }
            else if (statNameRaw == categoryMatch) {
                // if it matches exactly, we don't know the name. will be defaulted to category later on
                return {
                    category: statCategory,
                    name: null
                };
            }
        }
    }
    // this should never happen, as it'll default to misc and return if nothing is found
    return {
        category: null,
        name: statNameRaw
    };
}
exports.categorizeStat = categorizeStat;
exports.statUnits = {
    time: ['_best_time', '_best_time_2'],
    date: ['first_join'],
    coins: ['purse'],
    leaderboards: ['leaderboards_count']
};
function getStatUnit(name) {
    for (const [unitName, statMatchers] of Object.entries(exports.statUnits)) {
        for (const statMatch of statMatchers) {
            let trailingEnd = statMatch[0] === '_';
            let trailingStart = statMatch.substr(-1) === '_';
            if ((trailingStart && name.startsWith(statMatch))
                || (trailingEnd && name.endsWith(statMatch))
                || (name == statMatch))
                return unitName;
        }
    }
}
exports.getStatUnit = getStatUnit;
function cleanProfileStats(data) {
    var _a, _b;
    // TODO: add type for statsRaw (probably in hypixelApi.ts since its coming from there)
    const stats = [];
    const rawStats = (_a = data === null || data === void 0 ? void 0 : data.stats) !== null && _a !== void 0 ? _a : {};
    for (const statNameRaw in rawStats) {
        const statValue = rawStats[statNameRaw];
        let { category: statCategory, name: statName } = categorizeStat(statNameRaw);
        stats.push({
            categorizedName: statName !== null && statName !== void 0 ? statName : 'total',
            value: statValue,
            rawName: statNameRaw,
            category: statCategory,
            unit: (_b = getStatUnit(statNameRaw)) !== null && _b !== void 0 ? _b : null
        });
    }
    return stats;
}
exports.cleanProfileStats = cleanProfileStats;
