"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cleanSkyBlockAuctionsResponse = void 0;
const inventory_1 = require("./inventory");
async function cleanSkyBlockAuction(rawAuction) {
    const currentBid = rawAuction.highest_bid_amount || rawAuction.starting_bid;
    const nextBid = rawAuction.highest_bid_amount === 0 ? currentBid : currentBid * 1.15;
    return {
        uuid: rawAuction.uuid,
        sellerUuid: rawAuction.auctioneer,
        sellerProfileUuid: rawAuction.profile_id,
        start: rawAuction.start / 1000,
        end: rawAuction.end / 1000,
        item: await inventory_1.cleanItemEncoded(rawAuction.item_bytes),
        bidAmount: currentBid,
        nextBidAmount: nextBid,
        bin: rawAuction.bin,
    };
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
