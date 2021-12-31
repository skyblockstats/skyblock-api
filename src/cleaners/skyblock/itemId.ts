// change weird item names to be more consistent with vanilla
const ITEMS = {
	'log': 'oak_log',
	'log:1': 'spruce_log',
	'log:2': 'birch_log',
	'log:3': 'jungle_log',
	'log_2': 'acacia_log',
	'log_2:1': 'dark_oak_log',

	'ink_sack': 'ink_sac',
	'ink_sack:3': 'cocoa_beans',
	'ink_sack:4': 'lapis_lazuli',

	'cocoa': 'cocoa_beans',

	'raw_fish': 'cod',
	'raw_fish:1': 'salmon',
	'raw_fish:2': 'tropical_fish',
	'raw_fish:3': 'pufferfish',

	'raw_salmon': 'salmon',
	'cooked_fish': 'cooked_cod',

	'seeds': 'wheat_seeds',
	'sulphur': 'gunpowder',
	'raw_chicken': 'chicken',
	'pork': 'porkchop',
	'potato_item': 'potato',
	'carrot_item': 'carrot',
	'mushroom_collection': 'red_mushroom',
	'nether_stalk': 'nether_wart',
	'water_lily': 'lily_pad',
	'melon': 'melon_slice',
	'ender_stone': 'end_stone',
	'gemstone_collection': 'gemstone',

	'huge_mushroom_1': 'red_mushroom_block',
	'huge_mushroom_2': 'brown_mushroom_block',

	'iron_ingot': 'iron_ingot',

	'iron': 'iron_ingot',
	'gold': 'gold_ingot',

	'endstone': 'end_stone',
	'lapis_lazuli_block': 'lapis_block',
	'snow_ball': 'snowball',
	'raw_beef': 'beef',
	'eye_of_ender': 'ender_eye',
	'grilled_pork': 'cooked_porkchop',
	'glistering_melon': 'glistering_melon_slice',
	'cactus_green': 'green_dye',

	'enchanted_lapis_lazuli': 'enchanted_lapis_lazuli',
	'enchanted_potato': 'enchanted_potato',
	'enchanted_birch_log': 'enchanted_birch_log',
	'enchanted_gunpowder': 'enchanted_gunpowder',
	'enchanted_raw_salmon': 'enchanted_salmon',
	'enchanted_raw_chicken': 'enchanted_chicken',
	'enchanted_water_lily': 'enchanted_lily_pad',
	'enchanted_ink_sack': 'enchanted_ink_sac',
	'enchanted_melon': 'enchanted_melon_slice',
	'enchanted_glistering_melon': 'enchanted_glistering_melon_slice'
} as const

/** Weirdly named items by Hypixel */
export type hypixelItemNames = keyof typeof ITEMS
/** Cleaner names by us */
export type cleanItemNames = (typeof ITEMS)[keyof typeof ITEMS]

/** Clean an item with a weird name (log_2:1) and make it have a better name (dark_oak_log) */
export function cleanItemId(itemId: string): cleanItemNames {
	return ITEMS[itemId.toLowerCase()] ?? itemId.toLowerCase()
}
