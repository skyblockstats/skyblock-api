"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cleanSkyBlockAuctionsResponse = void 0;
const inventory_1 = require("./inventory");
async function cleanSkyBlockAuction(rawAuction) {
    var _a;
    if (!rawAuction.seller) {
        const currentBid = rawAuction.bin ? rawAuction.starting_bid : rawAuction.highest_bid_amount || 0;
        const nextBid = Math.round(rawAuction.highest_bid_amount === 0 ? rawAuction.starting_bid : currentBid * 1.15);
        return {
            uuid: rawAuction.uuid,
            sellerUuid: rawAuction.auctioneer,
            sellerProfileUuid: rawAuction.profile_id,
            start: rawAuction.start / 1000,
            end: rawAuction.end / 1000,
            item: await (0, inventory_1.cleanItemEncoded)(rawAuction.item_bytes),
            bidAmount: currentBid,
            nextBidAmount: nextBid,
            bin: (_a = rawAuction.bin) !== null && _a !== void 0 ? _a : false,
        };
    }
    else {
        // in auctions_ended they're returned in a different format because hypixel is weird
        return {
            uuid: rawAuction.auction_id,
            sellerUuid: rawAuction.seller,
            sellerProfileUuid: rawAuction.seller_profile,
            start: undefined,
            end: rawAuction.timestamp,
            item: await (0, inventory_1.cleanItemEncoded)(rawAuction.item_bytes),
            bidAmount: rawAuction.price,
            nextBidAmount: rawAuction.price,
            bin: rawAuction.bin
        };
    }
}
async function cleanSkyBlockAuctionsResponse(data) {
    const promises = [];
    for (const rawAuction of data.auctions) {
        promises.push(cleanSkyBlockAuction(rawAuction));
    }
    const auctions = await Promise.all(promises);
    return {
        pageCount: data.totalPages,
        lastUpdated: data.lastUpdated / 1000,
        auctions: auctions
    };
}
exports.cleanSkyBlockAuctionsResponse = cleanSkyBlockAuctionsResponse;
