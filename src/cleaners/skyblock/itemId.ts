// change weird item names to be more consistent with modern vanilla
const ITEMS = {
	'log': 'oak_log',
	'log:1': 'spruce_log',
	'log:2': 'birch_log',
	'log:3': 'jungle_log',
	'log_2': 'acacia_log',
	'log_2:1': 'dark_oak_log',

	'sand:1': 'red_sand',

	'ink_sack': 'ink_sac',
	'ink_sack:3': 'cocoa_beans',
	'ink_sack:4': 'lapis_lazuli',

	'raw_fish': 'cod',
	'raw_fish:1': 'salmon',
	'raw_fish:2': 'tropical_fish',
	'raw_fish:3': 'pufferfish',

	'raw_salmon': 'salmon',
	'cooked_fish': 'cooked_cod',
	'magma_fish': 'magmafish',

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
	'mycel': 'mycelium',
	'cocoa': 'cocoa_beans',

	'redstone_lamp_off': 'redstone_lamp',
	'redstone_comparator': 'comparator',
	'redstone_torch_on': 'redstone_torch',
	'iron_plate': 'light_weighted_pressure_plate',
	'gold_plate': 'heavy_weighted_pressure_plate',

	'huge_mushroom_1': 'red_mushroom_block',
	'huge_mushroom_2': 'brown_mushroom_block',

	'iron_ingot': 'iron_ingot',

	'iron': 'iron_ingot',
	'gold': 'gold_ingot',

	'hard_clay': 'stained_hardened_clay',
	'stained_clay': 'stained_hardened_clay',

	'wood_sword': 'wooden_sword',
	'wood_spade': 'wooden_shovel',
	'wood_pickaxe': 'wooden_pickaxe',
	'wood_axe': 'wooden_axe',
	'wood_hoe': 'wooden_hoe',

	'stone_spade': 'stone_shovel',

	'gold_sword': 'golden_sword',
	'gold_spade': 'golden_shovel',
	'gold_pickaxe': 'golden_pickaxe',
	'gold_axe': 'golden_axe',
	'gold_hoe': 'golden_hoe',
	'gold_helmet': 'golden_helmet',
	'gold_chestplate': 'golden_chestplate',
	'gold_leggings': 'golden_leggings',
	'gold_boots': 'golden_boots',
	'gold_barding': 'golden_horse_armor',

	'iron_barding': 'iron_horse_armor',
	'iron_spade': 'iron_shovel',

	'diamond_spade': 'diamond_shovel',
	'diamond_barding': 'diamond_horse_armor',

	'gold_record': 'record_13',
	'green_record': 'record_cat',
	'record_3': 'record_blocks',
	'record_4': 'record_chirp',
	'record_5': 'record_far',
	'record_6': 'record_mall',
	'record_7': 'record_mellohi',
	'record_8': 'record_stal',
	'record_9': 'record_strad',
	'record_10': 'record_ward',
	'record_12': 'record_wait',

	'sulphur_ore': 'sulphur',

	'step': 'stone_slab',
	'nether_fence': 'nether_brick_fence',
	'empty_map': 'map',
	'nether_brick_item': 'nether_brick',
	'book_and_quill': 'writable_book',
	'mushroom_soup': 'mushroom_stew',
	'red_rose': 'red_flower',
	'firework': 'fireworks',
	'skull_item': 'skull',
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
export function cleanItemId(itemId: string): string {
	itemId = itemId.toLowerCase()
	if (itemId in ITEMS)
		return ITEMS[itemId]
	if (itemId.includes(':')) {
		const [item, damage] = itemId.split(':')
		if (item in ITEMS)
			return ITEMS[item] + ':' + damage
	}
	return itemId
}
