import typedHypixelApi from 'typed-hypixel-api'
import { fetchItemList } from '../../hypixel.js'
import { Item } from './inventory.js'
import { cleanItemId } from './itemId.js'

export interface BazaarItem {
	item: Item

	/** The sum of all item amounts in all buy orders. */
	demand: number
	/**
	 * How much it costs to instasell the item right now. This is also how much
	 * the top buy order is priced.
	 */
	instasellPrice: number
	/** The number of instasells in the past week. */
	weeklyInstasells: number

	/** The sum of all item amounts in all sell orders. */
	supply: number
	/**
	 * How much it costs to instabuy the item right now. This is also how much
	 * you'll get for doing a sell order.
	 */
	instabuyPrice: number
	weeklyInstabuys: number
}

export async function cleanBazaar(data: typedHypixelApi.SkyBlockBazaarResponse): Promise<BazaarItem[]> {
	const bazaarItems: BazaarItem[] = []

	const itemList = await fetchItemList()

	for (const item of Object.values(data.products)) {
		const itemSkyblockId = item.quick_status.productId
		const itemListItem = itemList.list.find(i => i.id === itemSkyblockId)
		bazaarItems.push({
			item: {
				id: itemSkyblockId,
				vanillaId: itemListItem?.vanillaId ?? cleanItemId(itemSkyblockId),
				display: itemListItem?.display ?? {
					name: itemSkyblockId,
				},
				headTexture: itemListItem?.headTexture,
			},

			supply: item.quick_status.buyVolume,
			instasellPrice: item.sell_summary.length > 0 ? item.sell_summary[0].pricePerUnit : 0,
			weeklyInstabuys: item.quick_status.buyMovingWeek,

			demand: item.quick_status.sellVolume,
			instabuyPrice: item.buy_summary.length > 0 ? item.buy_summary[0].pricePerUnit : 0,
			weeklyInstasells: item.quick_status.sellMovingWeek,
		})
	}

	return bazaarItems
}