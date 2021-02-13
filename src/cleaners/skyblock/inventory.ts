import * as nbt from 'prismarine-nbt'

function base64decode(base64: string): Buffer {
	return Buffer.from(base64, 'base64')
}

export function cleanInventory(encodedNbt: string): Promise<any> {
	return new Promise(resolve => {
		const base64Data = base64decode(encodedNbt)
		nbt.parse(base64Data, false, (err, value) => {
			const simplifiedNbt = nbt.simplify(value)
			// .i because hypixel decided to do that
			resolve(simplifiedNbt.i)
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

export async function cleanInventories(data: any): Promise<typeof INVENTORIES> {
	const cleanInventories: any = {}
	for (const cleanInventoryName in INVENTORIES) {
		const hypixelInventoryName = INVENTORIES[cleanInventoryName]
		const encodedInventoryContents = data[hypixelInventoryName]?.data
		let inventoryContents
		if (encodedInventoryContents)
			inventoryContents = await cleanInventory(encodedInventoryContents)
		cleanInventories[cleanInventoryName] = inventoryContents
	}
	return cleanInventories
}