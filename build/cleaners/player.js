"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cleanPlayerResponse = void 0;
const profiles_1 = require("./skyblock/profiles");
const socialmedia_1 = require("./socialmedia");
const rank_1 = require("./rank");
const util_1 = require("../util");
async function cleanPlayerResponse(data) {
    var _a, _b;
    // Cleans up a 'player' api response
    if (!data)
        return; // bruh
    return {
        uuid: util_1.undashUuid(data.uuid),
        username: data.displayname,
        rank: rank_1.cleanRank(data),
        socials: socialmedia_1.cleanSocialMedia(data),
        first_join: data.firstLogin / 1000,
        profiles: profiles_1.cleanPlayerSkyblockProfiles((_b = (_a = data.stats) === null || _a === void 0 ? void 0 : _a.SkyBlock) === null || _b === void 0 ? void 0 : _b.profiles)
    };
}
exports.cleanPlayerResponse = cleanPlayerResponse;
