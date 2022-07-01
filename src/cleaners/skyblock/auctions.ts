import typedHypixelApi from 'typed-hypixel-api'
import { cleanInventory, Item } from './inventory.js'
import * as cached from '../../hypixelCached.js'
import { CleanPlayer } from '../player.js'

export interface Auction {
    id: string
    sellerUuid: string
    sellerProfileUuid: string
    buyer: CleanPlayer | null
    creationTimestamp: number
    boughtTimestamp: number
    coins: number
    bin: boolean
    item: Item
}


export async function cleanAuctions(data: typedHypixelApi.SkyBlockRequestAuctionResponse): Promise<Auction[]> {
    const auctionPromises: Promise<Auction>[] = []
    for (const auction of data.auctions) {
        auctionPromises.push(cleanAuction(auction))
    }

    const auctions = await Promise.all(auctionPromises)

    // sort by newer first
    auctions.sort((a, b) => b.creationTimestamp - a.creationTimestamp)

    return auctions

}

async function cleanAuction(auction: typedHypixelApi.SkyBlockRequestAuctionResponse['auctions'][number]): Promise<Auction> {
    const buyerUuid = auction.end ? auction.bids[auction.bids.length - 1].bidder : null
    const buyer = buyerUuid ? await cached.fetchPlayer(buyerUuid, false) : null
    return {
        id: auction.uuid,
        sellerUuid: auction.auctioneer,
        sellerProfileUuid: auction.profile_id,
        creationTimestamp: auction.start,
        buyer,
        boughtTimestamp: auction.end,
        coins: auction.highest_bid_amount,
        bin: auction.bin ?? false,
        item: (await cleanInventory(typeof auction.item_bytes === 'string' ? auction.item_bytes : auction.item_bytes.data))[0]
    }
}
