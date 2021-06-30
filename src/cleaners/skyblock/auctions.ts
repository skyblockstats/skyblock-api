import { cleanItemEncoded, Item } from './inventory'

export interface Auction {
	uuid: string
	sellerUuid: string
	sellerProfileUuid: string
	start: number
	end: number
	item: Item
	bidAmount: number
	nextBidAmount: number
	bin: boolean
}

export interface AuctionsResponse {
	pageCount: number
	lastUpdated: number
	auctions: Auction[]
}

async function cleanSkyBlockAuction(rawAuction: any): Promise<Auction> {
	const currentBid = rawAuction.highest_bid_amount || rawAuction.starting_bid
	const nextBid = Math.round(rawAuction.highest_bid_amount === 0 ? currentBid : currentBid * 1.15)
	return {
		uuid: rawAuction.uuid,
		sellerUuid: rawAuction.auctioneer,
		sellerProfileUuid: rawAuction.profile_id,
		start: rawAuction.start / 1000,
		end: rawAuction.end / 1000,
		item: await cleanItemEncoded(rawAuction.item_bytes),
		bidAmount: currentBid,
		nextBidAmount: nextBid,
		bin: rawAuction.bin,
	}
}

export async function cleanSkyBlockAuctionsResponse(data: any): Promise<AuctionsResponse> {
	const promises: Promise<Auction>[] = []
	for (const rawAuction of data.auctions) {
		promises.push(cleanSkyBlockAuction(rawAuction))
	}
	const auctions = await Promise.all(promises)
	return {
		pageCount: data.totalPages,
		lastUpdated: data.lastUpdated / 1000,
		auctions: auctions
	}
}
