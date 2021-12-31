import { cleanItemId, hypixelItemNames } from './itemId.js'
import * as constants from '../../constants.js'

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
export type CollectionNames = (typeof COLLECTION_CATEGORIES)[CollectionCategory][number]


/** The xp amounts that levels should be rounded down to. This is used for the automatic generation of the xp requirements. */
const collectionXpSteps = [
	0,			25,			40,			50,			100,
	150,		200,		250,		400,		500,
	750,		800,		1_000,		1_200,		1_500,
	1_700,		2_000,		2_400,		2_500,		3_000,
	4_000,		4_800,		5_000,		6_000,		9_000,
	10_000,		15_000,		15_500,		20_000,		25_000,
	30_000,		40_000,		45_000,		50_000,		60_000,
	70_000,		75_000,		100_000,	150_000,	200_000,
	250_000,	300_000,	400_000,	500_000,	600_000,
	800_000,	1_000_000,	1_200_000,	1_400_000,
]

/** Round down an xp number to the lowest step */
function roundDownXp(xp: number): number {
	let roundedDown = 0
	for (const step of collectionXpSteps) {
		if (xp >= step && xp > roundedDown) {
			roundedDown = step
		}
	}
	return roundedDown
}


/**
 * Get the collection level from the collection name and xp
 * @param collectionId The collection name, like "red_mushroom"
 * @param xp The xp that we're finding the level for
 */
export function getCollectionLevel(
	collectionName: CollectionNames,
	xp: number,
	table: { [ key in CollectionNames ]: (number | null)[] | undefined }
): number | null {
	const xpTable = table[collectionName]

	if (!xpTable)
		return null

	const collLevel = [...xpTable].reverse().findIndex(levelXp => levelXp && (xp >= levelXp))
	return (collLevel === -1 ? 0 : xpTable.length - collLevel) + 1
}

export interface Collection {
	name: string
	xp: number
	level: number
	category: CollectionCategory
	levelXp: number | null
	levelXpRequired: number | null
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

export async function cleanCollections(data: any): Promise<Collection[]> {
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

	const collectionXpTable = await constants.fetchCollectionXpTable()

	// the updates that we're gonna have to make to the constants after this loop
	let collectionUpdates: constants.JsonXpTableUpdate[] = []
	
	for (const collectionNameRaw in playerCollectionXpsRaw) {
		const collectionXp: number = playerCollectionXpsRaw[collectionNameRaw]
		const collectionName = cleanItemId(collectionNameRaw)

		const collectionLevel = playerCollectionTiers[collectionName] ?? null
		const calculatedCollectionLevel = getCollectionLevel(collectionName as CollectionNames, collectionXp, collectionXpTable)

		// calculate the xp required to go to the next level
		const collectionXpList = collectionXpTable[collectionName as CollectionNames]
		const collectionXpRequired = collectionXpList ? collectionXpList[collectionLevel] : null
		// calculate the xp that we have in this level
		const collectionXpInLevel = collectionXpList ? collectionXpList[collectionLevel - 1] : null

		// if the calculated collection is wrong, that means we need to update the constant.
		if (calculatedCollectionLevel !== collectionLevel) {
			console.warn(`The xp table for ${collectionName} is wrong. Calculated: ${calculatedCollectionLevel}, actual: ${collectionLevel}`)
			collectionUpdates.push({
				level: collectionLevel,
				name: collectionName,
				xp: roundDownXp(collectionXp)
			})
		}

		const collectionCategory = getCategory(collectionName) ?? 'unknown'

		// in some very weird cases the collection level will be undefined, we should ignore these collections
		if (collectionLevel !== undefined)
			playerCollections.push({
				name: collectionName,
				xp: collectionXp,
				level: collectionLevel,
				category: collectionCategory,
				levelXp: collectionXpInLevel,
				levelXpRequired: collectionXpRequired
			})
	}
	await constants.updateCollectionXpTable(collectionUpdates)
	return playerCollections
}