"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cleanCollections = void 0;
const itemId_1 = require("./itemId");
const COLLECTIONS = {
    'farming': [
        'wheat',
        'carrot',
        'potato',
        'pumpkin',
        'melon_slice',
        'wheat_seeds',
        'red_mushroom',
        'cocoa_beans',
        'cactus',
        'sugar_cane',
        'feather',
        'leather',
        'porkchop',
        'chicken',
        'mutton',
        'rabbit',
        'nether_wart'
    ],
    'mining': [
        'cobblestone',
        'coal',
        'iron_ingot',
        'gold_ingot',
        'diamond',
        'lapis_lazuli',
        'emerald',
        'redstone',
        'quartz',
        'obsidian',
        'glowstone_dust',
        'gravel',
        'ice',
        'netherrack',
        'sand',
        'end_stone'
    ],
    'combat': [
        'rotten_flesh',
        'bone',
        'string',
        'spider_eye',
        'gunpowder',
        'ender_pearl',
        'ghast_tear',
        'slime_ball',
        'blaze_rod',
        'magma_cream'
    ],
    'foraging': [
        'oak_log',
        'spruce_log',
        'birch_log',
        'jungle_log',
        'acacia_log',
        'dark_oak_log'
    ],
    'fishing': [
        'cod',
        'salmon',
        'tropical_fish',
        'pufferfish',
        'prismarine_shard',
        'prismarine_crystals',
        'clay_ball',
        'lily_pad',
        'ink_sac',
        'sponge'
    ],
    // no item should be here, but in case a new collection is added itll default to this
    'unknown': []
};
// get a category name (farming) from a collection name (wheat)
function getCategory(collectionName) {
    for (const categoryName in COLLECTIONS) {
        const categoryItems = COLLECTIONS[categoryName];
        if (categoryItems.includes(collectionName))
            return categoryName;
    }
}
function cleanCollections(data) {
    var _a, _b, _c;
    // collection tiers show up like this: [ GRAVEL_3, GOLD_INGOT_2, MELON_-1, LOG_2:1_7, RAW_FISH:3_-1]
    // these tiers are the same for all players in a coop
    const playerCollectionTiersRaw = (_a = data === null || data === void 0 ? void 0 : data.unlocked_coll_tiers) !== null && _a !== void 0 ? _a : [];
    const playerCollectionTiers = {};
    for (const collectionTierNameValueRaw of playerCollectionTiersRaw) {
        const [collectionTierNameRaw, collectionTierValueRaw] = collectionTierNameValueRaw.split(/_(?=-?\d+$)/);
        const collectionName = itemId_1.cleanItemId(collectionTierNameRaw);
        // ensure it's at least 0
        const collectionValue = Math.max(parseInt(collectionTierValueRaw), 0);
        // if the collection hasn't been checked yet, or the new value is higher than the old, replace it
        if (!playerCollectionTiers[collectionName] || collectionValue > playerCollectionTiers[collectionName])
            playerCollectionTiers[collectionName] = collectionValue;
    }
    // collection names show up like this: { LOG: 49789, LOG:2: 26219, MUSHROOM_COLLECTION: 2923}
    // these values are different for each player in a coop
    const playerCollectionXpsRaw = (_b = data === null || data === void 0 ? void 0 : data.collection) !== null && _b !== void 0 ? _b : {};
    const playerCollections = [];
    for (const collectionNameRaw in playerCollectionXpsRaw) {
        const collectionXp = playerCollectionXpsRaw[collectionNameRaw];
        const collectionName = itemId_1.cleanItemId(collectionNameRaw);
        const collectionLevel = playerCollectionTiers[collectionName];
        const collectionCategory = (_c = getCategory(collectionName)) !== null && _c !== void 0 ? _c : 'unknown';
        // in some very weird cases the collection level will be undefined, we should ignore these collections
        if (collectionLevel !== undefined)
            playerCollections.push({
                name: collectionName,
                xp: collectionXp,
                level: collectionLevel,
                category: collectionCategory
            });
    }
    return playerCollections;
}
exports.cleanCollections = cleanCollections;
