import { cleanItemId, hypixelItemNames } from './itemId.js'
import typedHypixelApi from 'typed-hypixel-api'
import * as constants from '../../constants.js'

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
		'nether_wart',
		'sulphur'
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
		'red_sand',
		'end_stone',
		'mithril_ore',
		'gemstone',
		'hard_stone',
		'sulphur',
		'mycelium'
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
		'magmafish',
		'prismarine_shard',
		'prismarine_crystals',
		'clay_ball',
		'lily_pad',
		'ink_sac',
		'sponge'
	],
	// no item should be here, but in case a new collection is added itll default to this
	'unknown': []
} as const

type CollectionCategory = keyof typeof COLLECTIONS

export interface Collection {
	name: string
	amount: number
	level: number
	category: CollectionCategory
}

// get a category name (farming) from a collection name (wheat)
function getCategory(collectionName): CollectionCategory | undefined {
	for (const categoryName in COLLECTIONS) {
		const categoryItems = COLLECTIONS[categoryName]
		if (categoryItems.includes(collectionName))
			return categoryName as CollectionCategory
	}
}

export function cleanCollections(data: typedHypixelApi.SkyBlockProfileMember): Collection[] {

	// collection tiers show up like this: [ GRAVEL_3, GOLD_INGOT_2, MELON_-1, LOG_2:1_7, RAW_FISH:3_-1]
	// these tiers are the same for all players in a coop
	const playerCollectionTiersRaw: string[] = data?.unlocked_coll_tiers ?? []
	const playerCollectionTiers: { [key: string]: number } = {}

	let rawCollectionNames: Set<string> = new Set()

	for (const collectionTierNameValueRaw of playerCollectionTiersRaw) {
		const [collectionTierNameRaw, collectionTierValueRaw] = collectionTierNameValueRaw.split(/_(?=-?\d+$)/)
		rawCollectionNames.add(collectionTierNameRaw)
		const collectionName = cleanItemId(collectionTierNameRaw)
		// ensure it's at least 0
		const collectionValue: number = Math.max(parseInt(collectionTierValueRaw), 0)

		// if the collection hasn't been checked yet, or the new value is higher than the old, replace it
		if (!playerCollectionTiers[collectionName] || collectionValue > playerCollectionTiers[collectionName])
			playerCollectionTiers[collectionName] = collectionValue
	}

	constants.addCollections(Array.from(rawCollectionNames))


	// collection names show up like this: { LOG: 49789, LOG:2: 26219, MUSHROOM_COLLECTION: 2923}
	// these values are different for each player in a coop
	const playerCollectionXpsRaw: { [key in hypixelItemNames]?: number } = data?.collection ?? {}
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
				amount: collectionXp,
				level: collectionLevel,
				category: collectionCategory
			})
	}
	return playerCollections
}