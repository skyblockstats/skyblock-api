"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cleanSlayers = void 0;
const slayerLevels = 4; // number of slayer levels, this might be 5 soon
const SLAYER_NAMES = {
    spider: 'tarantula',
    zombie: 'revenant',
    wolf: 'sven'
};
function cleanSlayers(data) {
    const slayers = [];
    const slayersDataRaw = data === null || data === void 0 ? void 0 : data.slayer_bosses;
    let totalXp = 0;
    for (const slayerNameRaw in slayersDataRaw) {
        const slayerDataRaw = slayersDataRaw[slayerNameRaw];
        // convert name provided by api (spider) to the real name (tarantula)
        const slayerName = SLAYER_NAMES[slayerNameRaw];
        const slayerXp = slayerDataRaw.xp;
        const slayerTiers = [];
        for (const slayerDataKey in slayerDataRaw) {
            // if a key starts with boss_kills_tier_ (boss_kills_tier_1), get the last number
            if (slayerDataKey.startsWith('boss_kills_tier_')) {
                const slayerTierRaw = parseInt(slayerDataKey.substr('boss_kills_tier_'.length));
                const slayerTierKills = slayerDataRaw[slayerDataKey];
                // add 1 since hypixel is using 0 indexed tiers
                const slayerTier = slayerTierRaw + 1;
                slayerTiers.push({
                    kills: slayerTierKills,
                    tier: slayerTier
                });
            }
        }
        // if the slayer tier length is less than the max, add more empty ones
        while (slayerTiers.length < slayerLevels)
            slayerTiers.push({
                tier: slayerTiers.length + 1,
                kills: 0
            });
        const slayer = {
            name: slayerName,
            raw_name: slayerNameRaw,
            tiers: slayerTiers,
            xp: slayerXp
        };
        slayers.push(slayer);
        // add the xp from this slayer to the total xp
        totalXp += slayerXp;
    }
    return {
        xp: totalXp,
        bosses: slayers
    };
}
exports.cleanSlayers = cleanSlayers;
// function getSlayerLeaderboards() {
// }
