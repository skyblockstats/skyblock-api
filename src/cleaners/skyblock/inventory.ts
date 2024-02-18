import typedHypixelApi from 'typed-hypixel-api'
import * as nbt from 'prismarine-nbt'


function base64decode(base64: string): Buffer {
	return Buffer.from(base64, 'base64')
}

export interface Item {
	id: string
	count: number
	vanillaId: string

	display: {
		name: string
		lore: string[]
		glint: boolean
	}

	reforge?: string
	anvilUses?: number
	timestamp?: string
	enchantments?: { [name: string]: number }
	petInfo?: {
		id: string
	}

	headTexture?: string
}

export type Inventory = Item[]

export function headIdFromBase64(headDataBase64: string): string | undefined {
	const headData = JSON.parse(base64decode(headDataBase64).toString())
	const headDataUrl = headData?.textures?.SKIN?.url
	if (headDataUrl) {
		const splitUrl = headDataUrl.split('/')
		return splitUrl[splitUrl.length - 1]
	}
	return undefined
}

function cleanItem(rawItem): Item | null {
	// if the item doesn't have an id, it isn't an item
	if (rawItem.id === undefined) return null

	const vanillaId: number = rawItem.id
	const itemCount = rawItem.Count
	const damageValue = rawItem.Damage
	const itemTag = rawItem.tag
	const extraAttributes = itemTag?.ExtraAttributes ?? {}
	let headId: string | undefined

	if (vanillaId === 397) {
		const headDataBase64 = itemTag?.SkullOwner?.Properties?.textures?.[0]?.Value
		if (headDataBase64)
			headId = headIdFromBase64(headDataBase64)
	}


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
		anvilUses: extraAttributes?.anvil_uses,
		timestamp: extraAttributes?.timestamp,
		petInfo: extraAttributes?.petInfo ? {
			id: JSON.parse(extraAttributes.petInfo).type
		} : undefined,

		headTexture: headId,
	}
}

function cleanItems(rawItems): Inventory {
	return rawItems.map(cleanItem)
}

export async function cleanInventory(encodedNbt: string): Promise<Inventory> {
	const base64Data = base64decode(encodedNbt)
	const value: any = await new Promise((resolve, reject) => nbt.parse(base64Data, false, (err, value) => { if (err) reject(err); else resolve(value) }))
	const simplifiedNbt = nbt.simplify(value)
	// do some basic cleaning on the items and return
	return cleanItems(simplifiedNbt.i)
}

export const INVENTORIES = {
	armor: 'inv_armor',
	inventory: 'inv_contents',
	ender_chest: 'ender_chest_contents',
	accessory_bag: 'talisman_bag',
	potion_bag: 'potion_bag',
	fishing_bag: 'fishing_bag',
	quiver: 'quiver',
	trick_or_treat_bag: 'candy_inventory_contents',
	wardrobe: 'wardrobe_contents',
	personal_vault: 'personal_vault_contents'
}

export type Backpack = {
	icon: Item | null,
	items: Item[],
	slot: string,
};

export type Inventories = { backpacks: Backpack[] } & { [name in keyof typeof INVENTORIES]: Item[] }

export async function cleanInventories(data: typedHypixelApi.SkyBlockProfileMember): Promise<Inventories> {
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
	const backpacks = data.backpack_contents
	const backpackIcons = data.backpack_icons ?? {};
	const cleanBackpacks: Backpack[] = [];
	if (backpacks) {
		for (const backpackId in backpacks) {
			const backpack = backpacks[backpackId]
			const contents = await cleanInventory(backpack.data)
			const icon = backpackIcons[backpackId]

			cleanBackpacks.push({
				items: contents,
				slot: backpackId,
				icon: (icon && (await cleanInventory(icon.data))[0]) ?? null,
			})
		}
	}
	cleanInventories['backpacks'] = cleanBackpacks;
	return cleanInventories
}