export const slayerLevels = 5;
const SLAYER_NAMES = {
    spider: 'tarantula',
    zombie: 'revenant',
    wolf: 'sven'
};
export function cleanSlayers(data) {
    const slayers = [];
    const slayersDataRaw = data?.slayer_bosses;
    let totalXp = 0;
    let totalKills = 0;
    for (const slayerNameRaw in slayersDataRaw) {
        const slayerDataRaw = slayersDataRaw[slayerNameRaw];
        // convert name provided by api (spider) to the real name (tarantula)
        const slayerName = SLAYER_NAMES[slayerNameRaw];
        const slayerXp = slayerDataRaw.xp ?? 0;
        let slayerKills = 0;
        const slayerTiers = [];
        for (const slayerDataKey in slayerDataRaw) {
            // if a key starts with boss_kills_tier_ (boss_kills_tier_1), get the last number
            if (slayerDataKey.startsWith('boss_kills_tier_')) {
                const slayerTierRaw = parseInt(slayerDataKey.substr('boss_kills_tier_'.length));
                const slayerTierKills = slayerDataRaw[slayerDataKey] ?? 0;
                // add 1 since hypixel is using 0 indexed tiers
                const slayerTier = slayerTierRaw + 1;
                slayerTiers.push({
                    kills: slayerTierKills,
                    tier: slayerTier
                });
                // count up the total number of kills for this slayer
                if (slayerTierKills)
                    slayerKills += slayerTierKills;
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
            xp: slayerXp ?? 0,
            kills: slayerKills
        };
        slayers.push(slayer);
        // add the xp and kills from this slayer to the total xp
        if (slayerXp)
            totalXp += slayerXp;
        if (slayerKills)
            totalKills += slayerKills;
    }
    return {
        xp: totalXp,
        kills: totalKills,
        bosses: slayers
    };
}
