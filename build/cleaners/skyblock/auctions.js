"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cleanSkyBlockAuctionsResponse = void 0;
const constants_1 = require("../../constants");
const inventory_1 = require("./inventory");
async function cleanSkyBlockAuction(rawAuction) {
    var _a;
    const item = await (0, inventory_1.cleanItemEncoded)(rawAuction.item_bytes);
    // add item enchantments to enchantments.json
    if (item.enchantments && Object.keys(item.enchantments).length > 0)
        (0, constants_1.addEnchantments)(Object.keys(item.enchantments));
    if (!rawAuction.seller) {
        const currentBid = rawAuction.bin ? rawAuction.starting_bid : rawAuction.highest_bid_amount || 0;
        const nextBid = Math.round(rawAuction.highest_bid_amount === 0 ? rawAuction.starting_bid : currentBid * 1.15);
        return {
            uuid: rawAuction.uuid,
            sellerUuid: rawAuction.auctioneer,
            sellerProfileUuid: rawAuction.profile_id,
            start: rawAuction.start / 1000,
            end: rawAuction.end / 1000,
            item,
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
            end: rawAuction.timestamp / 1000,
            item,
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
