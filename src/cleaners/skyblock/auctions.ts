import typedHypixelApi from 'typed-hypixel-api'
import { cleanInventory, Item } from './inventory.js'
import * as cached from '../../hypixelCached.js'
import { CleanPlayer } from '../player.js'

export interface Auctions {
    auctions: Auction[]
    pages: number
}

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

const PAGE_SIZE = 20

export async function cleanAuctions(data: typedHypixelApi.SkyBlockRequestAuctionResponse, page: number): Promise<Auctions> {
    const auctionPromises: Promise<Auction>[] = []

    let rawAuctions = data.auctions
    // sort by newer first
    rawAuctions.sort((a, b) => b.start - a.start)

    const totalPages = Math.ceil(rawAuctions.length / PAGE_SIZE)

    rawAuctions = rawAuctions.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE)

    for (const auction of rawAuctions) {
        auctionPromises.push(cleanAuction(auction))
    }

    const auctions = await Promise.all(auctionPromises)

    return { auctions, pages: totalPages }
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
