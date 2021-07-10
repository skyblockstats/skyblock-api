import { cleanItemEncoded, Item } from './inventory'

export interface Auction {
	uuid: string
	sellerUuid: string
	sellerProfileUuid: string
	start?: number
	end: number
	item: Item
	/** The amount of the current bid. This is 0 if it's not a bin auction and no one has bid on the item yet. */
	bidAmount: number
	/** How many coins have to be spent to outbid. */
	nextBidAmount: number
	bin: boolean
}

export interface AuctionsResponse {
	pageCount?: number
	lastUpdated: number
	auctions: Auction[]
}

async function cleanSkyBlockAuction(rawAuction: any): Promise<Auction> {
	if (!rawAuction.seller) {
		const currentBid = rawAuction.bin ? rawAuction.starting_bid : rawAuction.highest_bid_amount || 0
		const nextBid = Math.round(rawAuction.highest_bid_amount === 0 ? rawAuction.starting_bid : currentBid * 1.15)
		return {
			uuid: rawAuction.uuid,
			sellerUuid: rawAuction.auctioneer,
			sellerProfileUuid: rawAuction.profile_id,
			start: rawAuction.start / 1000,
			end: rawAuction.end / 1000,
			item: await cleanItemEncoded(rawAuction.item_bytes),
			bidAmount: currentBid,
			nextBidAmount: nextBid,
			bin: rawAuction.bin ?? false,
		}
	} else {
		// in auctions_ended they're returned in a different format because hypixel is weird
		return {
			uuid: rawAuction.auction_id,
			sellerUuid: rawAuction.seller,
			sellerProfileUuid: rawAuction.seller_profile,
			start: undefined,
			end: rawAuction.timestamp,
			item: await cleanItemEncoded(rawAuction.item_bytes),
			bidAmount: rawAuction.price,
			nextBidAmount: rawAuction.price,
			bin: rawAuction.bin
		}
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
