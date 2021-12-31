import { cleanItemId, hypixelItemNames } from './itemId.js'

const COLLECTION_CATEGORIES = {
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
		'end_stone',
		'mithril',
		'hard_stone',
		'gemstone'
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
	'boss': [
		'bonzo',
		'scarf',
		'the_professor',
		'thorn',
		'livid',
		'sadan',
		'necron'
	],
	// no item should be here, but in case a new collection is added itll default to this
	'unknown': []
} as const


type CollectionCategory = keyof typeof COLLECTION_CATEGORIES
type CollectionNames = (typeof COLLECTION_CATEGORIES)[CollectionCategory][number]

// numbers taken from https://hypixel-skyblock.fandom.com/wiki/Collections
const COLLECTION_XP_TABLES: { [ key in CollectionNames ]: number[] } = {
	// farming
	wheat: [ 100, 250, 500, 1000, 2500, 10000, 15000, 25000, 50000, 100000, 70000 ],
	carrot: [ 250, 500, 1700, 5000, 10000, 25000, 50000, 100000 ],
	potato: [ 250, 500, 1700, 5000, 10000, 25000, 50000, 100000 ],
	pumpkin: [ 100, 250, 1000, 2500, 5000, 10000, 25000, 50000, 100000, 250000 ],
	melon_slice: [ 500, 1200, 5000, 15500, 25000, 50000, 100000, 250000 ],
	wheat_seeds: [ 100, 250, 1000, 2500, 5000 ],
	red_mushroom: [ 100, 250, 1000, 2500, 5000, 10000, 25000, 50000 ],
	cocoa_beans: [ 200, 500, 2000, 5000, 10000, 20000, 50000, 100000 ],
	cactus: [ 250, 500, 1000, 2500, 5000, 10000, 25000, 50000 ],
	sugar_cane: [ 250, 500, 1000, 2000, 5000, 10000, 20000, 50000 ],
	feather: [ 100, 250, 1000, 2500, 5000, 10000, 25000, 50000 ],
	leather: [ 100, 250, 1000, 2500, 5000, 10000, 25000, 50000, 100000 ],
	porkchop: [ 100, 250, 1000, 2500, 5000, 10000, 25000, 50000 ],
	chicken: [ 100, 250, 1000, 2500, 5000, 10000, 25000, 50000 ],
	mutton: [ 100, 250, 1000, 2500, 5000, 10000, 25000, 50000 ],
	rabbit: [ 100, 250, 1000, 2500, 5000, 10000, 25000, 50000 ],
	nether_wart: [ 100, 250, 1000, 2500, 5000, 10000, 25000, 50000, 75000, 100000, 250000 ],

	// mining
	cobblestone: [ 100, 250, 1000, 2500, 5000, 10000, 25000, 40000 ],
	coal: [ 100, 250, 1000, 2500, 5000, 10000, 25000, 50000 ],
	iron_ingot: [ 100, 250, 1000, 2500, 5000, 10000, 25000, 50000, 100000, 200000, 400000 ],
	gold_ingot: [ 100, 250, 1000, 2500, 5000, 10000, 25000, 50000 ],
	diamond: [ 100, 250, 1000, 2500, 5000, 10000, 25000, 50000 ],
	lapis_lazuli: [ 500, 1000, 2000, 10000, 25000, 50000, 100000, 150000, 250000 ],
	emerald: [ 100, 250, 1000, 5000, 15000, 30000, 50000, 100000 ],
	redstone: [ 250, 750, 1500, 3000, 5000, 10000, 25000, 50000, 200000, 400000, 600000, 800000, 1000000, 1200000, 1400000 ],
	quartz: [ 100, 250, 1000, 2500, 5000, 10000, 25000, 50000 ],
	obsidian: [ 100, 250, 1000, 2500, 5000, 10000, 25000, 50000, 100000 ],
	glowstone_dust: [ 100, 250, 1000, 2500, 5000, 10000, 25000, 50000 ],
	gravel: [ 100, 250, 1000, 2500, 5000, 10000, 15000, 50000 ],
	ice: [ 100, 250, 500, 1000, 5000, 10000, 50000, 100000, 250000 ],
	netherrack: [ 250, 500, 1000, 5000 ],
	sand: [ 100, 250, 500, 1000, 2500, 5000 ],
	end_stone: [ 100, 250, 1000, 2500, 5000, 10000, 15000, 25000, 50000 ],
	mithril: [ 250, 1000, 2500, 5000, 10000, 250000, 500000, 1000000 ],
	hard_stone: [ 50, 1000, 5000, 50000, 150000, 300000, 1000000 ],
	gemstone: [ 100, 250, 1000, 2500, 5000, 25000, 100000, 250000, 500000 ],

	// combat
	rotten_flesh: [ 100, 250, 1000, 2500, 5000, 10000, 25000, 50000 ],
	bone: [ 100, 250, 1000, 2500, 5000, 10000, 25000, 50000, 150000 ],
	string: [ 100, 250, 1000, 2500, 5000, 10000, 25000, 50000 ],
	spider_eye: [ 100, 250, 1000, 2500, 5000, 10000, 25000, 50000 ],
	gunpowder: [ 100, 250, 1000, 2500, 5000, 10000, 25000, 50000 ],
	ender_pearl: [ 250, 1000, 2500, 5000, 10000, 15000, 25000, 50000 ],
	ghast_tear: [ 100, 250, 1000, 2500, 5000, 10000, 25000, 50000 ],
	slime_ball: [ 100, 250, 1000, 2500, 5000, 10000, 25000, 50000 ],
	blaze_rod: [ 100, 250, 1000, 2500, 5000, 10000, 25000, 50000 ],
	magma_cream: [ 100, 250, 1000, 2500, 5000, 10000, 25000, 50000 ],

	// foraging
	oak_log: [ 100, 250, 500, 1000, 2000, 5000, 10000, 30000 ],
	spruce_log: [ 100, 250, 1000, 2000, 5000, 10000, 25000, 50000 ],
	birch_log: [ 100, 250, 500, 1000, 2000, 5000, 10000, 25000 ],
	dark_oak_log: [ 100, 250, 1000, 2500, 5000, 10000, 25000, 50000 ],
	acacia_log: [ 100, 250, 500, 1000, 2000, 5000, 10000, 25000 ],
	jungle_log: [ 100, 250, 500, 1000, 2000, 5000, 10000, 25000 ],

	// fishing
	cod: [ 50, 100, 250, 500, 1000, 2500, 15000, 30000, 45000, 60000 ],
	salmon: [ 50, 100, 250, 500, 1000, 2500, 5000, 10000 ],
	tropical_fish: [ 25, 50, 100, 200, 400, 800 ],
	pufferfish: [ 50, 100, 150, 400, 800, 2400, 4800, 9000 ],
	prismarine_shard: [ 25, 50, 100, 200 ],
	prismarine_crystals: [ 25, 50, 100, 200, 400, 800 ],
	clay_ball: [ 100, 250, 1000, 2500 ],
	lily_pad: [ 50, 100, 200, 500, 1500, 3000, 6000, 10000 ],
	ink_sac: [ 40, 100, 200, 400, 800, 1500, 2500, 4000 ],
	sponge: [ 40, 100, 200, 400, 800, 1500, 2500, 4000 ],

	// boss
	bonzo: [ 50, 100, 150, 250, 1000 ],
	scarf: [ 50, 100, 150, 250, 1000 ],
	the_professor: [ 50, 100, 150, 250, 1000 ],
	thorn: [ 100, 150, 250, 400, 1000 ],
	livid: [ 100, 150, 250, 500, 750, 1000 ],
	sadan: [ 100, 150, 250, 500, 750, 1000 ],
	necron: [ 100, 150, 250, 500, 750, 1000 ],
}


export interface Collection {
	name: string
	xp: number
	level: number
	category: CollectionCategory
}

// get a category name (farming) from a collection name (wheat)
function getCategory(collectionName): CollectionCategory {
	for (const categoryName in COLLECTION_CATEGORIES) {
		const categoryItems = COLLECTION_CATEGORIES[categoryName]
		if (categoryItems.includes(collectionName))
			return categoryName as CollectionCategory
	}
	return 'unknown'
}

export function cleanCollections(data: any): Collection[] {
	// collection tiers show up like this: [ GRAVEL_3, GOLD_INGOT_2, MELON_-1, LOG_2:1_7, RAW_FISH:3_-1]
	// these tiers are the same for all players in a coop
	const playerCollectionTiersRaw: string[] = data?.unlocked_coll_tiers ?? []
	const playerCollectionTiers: { [ key: string ]: number } = {}

	for (const collectionTierNameValueRaw of playerCollectionTiersRaw) {
		const [ collectionTierNameRaw, collectionTierValueRaw ] = collectionTierNameValueRaw.split(/_(?=-?\d+$)/)
		const collectionName = cleanItemId(collectionTierNameRaw)
		// ensure it's at least 0
		const collectionValue: number = Math.max(parseInt(collectionTierValueRaw), 0)

		// if the collection hasn't been checked yet, or the new value is higher than the old, replace it
		if (!playerCollectionTiers[collectionName] || collectionValue > playerCollectionTiers[collectionName])
			playerCollectionTiers[collectionName] = collectionValue
	}

	// collection names show up like this: { LOG: 49789, LOG:2: 26219, MUSHROOM_COLLECTION: 2923}
	// these values are different for each player in a coop
	const playerCollectionXpsRaw: { [ key in hypixelItemNames ]: number } = data?.collection ?? {}
	const playerCollections: Collection[] = []
	
	for (const collectionNameRaw in playerCollectionXpsRaw) {
		const collectionXp: number = playerCollectionXpsRaw[collectionNameRaw]
		const collectionName = cleanItemId(collectionNameRaw)
		const collectionLevel = playerCollectionTiers[collectionName]
		const collectionCategory = getCategory(collectionName) ?? 'unknown'

		// in some very weird cases the collection level will be undefined, we should ignore these collections
		if (collectionLevel !== undefined)
			playerCollections.push({
				name: collectionName,
				xp: collectionXp,
				level: collectionLevel,
				category: collectionCategory
			})
	}
	return playerCollections
}