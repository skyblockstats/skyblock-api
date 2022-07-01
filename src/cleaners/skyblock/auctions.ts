import typedHypixelApi from 'typed-hypixel-api'
import { cleanInventory, headIdFromBase64, Item } from './inventory.js'


export interface Auction {
    id: string
    sellerUuid: string
    sellerProfileUuid: string
    buyerUuid: string | null
    creationTimestamp: number
    boughtTimestamp: number
    coins: number
    bin: boolean
    item: Item
}

export async function cleanAuctions(data: typedHypixelApi.SkyBlockRequestAuctionResponse): Promise<Auction[]> {
    const auctions: Auction[] = []
    for (const auction of data.auctions) {
        auctions.push({
            id: auction.uuid,
            sellerUuid: auction.auctioneer,
            sellerProfileUuid: auction.profile_id,
            creationTimestamp: auction.start,
            buyerUuid: auction.end ? auction.bids[auction.bids.length - 1].bidder : null,
            boughtTimestamp: auction.end,
            coins: auction.highest_bid_amount,
            bin: auction.bin ?? false,
            item: (await cleanInventory(typeof auction.item_bytes === 'string' ? auction.item_bytes : auction.item_bytes.data))[0]
        })
    }

    // sort by newer first
    auctions.sort((a, b) => a.creationTimestamp - b.creationTimestamp)

    return auctions

}