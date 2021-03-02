import * as nbt from 'prismarine-nbt'

function base64decode(base64: string): Buffer {
	return Buffer.from(base64, 'base64')
}

interface Item {
	id: string
	count: number
	vanillaId: string

	display: {
		name: string
		lore: string[]
		glint: boolean
	}

	reforge?: string
	anvil_uses?: number
	timestamp?: string
	enchantments?: { [ name: string ]: number }

	skull_owner?: string
}

export type Inventory = Item[]

function cleanItem(rawItem): Item {
	// if the item doesn't have an id, it isn't an item
	if (rawItem.id === undefined) return null

	const vanillaId: number = rawItem.id
	const itemCount = rawItem.Count
	const damageValue = rawItem.Damage
	const itemTag = rawItem.tag
	const extraAttributes = itemTag?.ExtraAttributes ?? {}
	return {
		id: extraAttributes?.id ?? null,
		count: itemCount ?? 1,
		vanillaId: damageValue ? `${vanillaId}:${damageValue}` : vanillaId.toString(),

		display: {
			name: itemTag?.display?.Name ?? 'null',
			lore: itemTag?.display?.Lore ?? [],
			// if it has an ench value in the tag, then it should have an enchant glint effect
			glint: (itemTag?.ench ?? []).length > 0
		},

		reforge: extraAttributes?.modifier,
		enchantments: extraAttributes?.enchantments,
		anvil_uses: extraAttributes?.anvil_uses,
		timestamp: extraAttributes?.timestamp,

		skull_owner: itemTag?.SkullOwner?.Properties?.textures?.[0]?.value ?? undefined,

	}
}

function cleanItems(rawItems): Inventory {
	return rawItems.map(cleanItem)
}

export function cleanInventory(encodedNbt: string): Promise<Inventory> {
	return new Promise(resolve => {
		const base64Data = base64decode(encodedNbt)
		nbt.parse(base64Data, false, (err, value) => {
			const simplifiedNbt = nbt.simplify(value)
			// do some basic cleaning on the items and return
			resolve(cleanItems(simplifiedNbt.i))
		})
	})
}

export const INVENTORIES = {
	armor: 'inv_armor',
	inventory: 'inv_contents',
	ender_chest: 'ender_chest_contents',
	talisman_bag: 'talisman_bag',
	potion_bag: 'potion_bag',
	fishing_bag: 'fishing_bag',
	quiver: 'quiver',
	trick_or_treat_bag: 'candy_inventory_contents',
	wardrobe: 'wardrobe_contents'
}

export type Inventories = { [name in keyof typeof INVENTORIES ]: Inventories }

export async function cleanInventories(data: any): Promise<Inventories> {
	const cleanInventories: any = {}
	for (const cleanInventoryName in INVENTORIES) {
		const hypixelInventoryName = INVENTORIES[cleanInventoryName]
		const encodedInventoryContents = data[hypixelInventoryName]?.data
		let inventoryContents: Inventory
		if (encodedInventoryContents) {
			inventoryContents = await cleanInventory(encodedInventoryContents)

			if (cleanInventoryName === 'armor')
				// the armor is sent from boots to head, the opposite makes more sense
				inventoryContents.reverse()

			cleanInventories[cleanInventoryName] = inventoryContents
		}
	}
	return cleanInventories
}