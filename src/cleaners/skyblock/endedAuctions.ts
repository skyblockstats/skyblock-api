import typedHypixelApi from 'typed-hypixel-api'
import { cleanInventory, headIdFromBase64, Item } from './inventory.js'
import { cleanItemId } from './itemId.js'


interface Auction {
    id: string
    sellerUuid: string
    sellerProfileUuid: string
    buyerUuid: string
    timestamp: number
    coins: number
    bin: boolean
    item: Item
}

export interface EndedAuctions {
    lastUpdated: number
    auctions: Auction[]
}

export async function cleanEndedAuctions(data: typedHypixelApi.SkyBlockRecentlyEndedAuctionsResponse): Promise<EndedAuctions> {
    const auctions: Auction[] = []
    for (const auction of data.auctions) {
        auctions.push({
            id: auction.auction_id,
            sellerUuid: auction.seller,
            sellerProfileUuid: auction.seller_profile,
            buyerUuid: auction.buyer,
            timestamp: auction.timestamp,
            coins: auction.price,
            bin: auction.bin,
            item: (await cleanInventory(auction.item_bytes))[0]
        })
    }

    return {
        lastUpdated: data.lastUpdated,
        auctions
    }
}