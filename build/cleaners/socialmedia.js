"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cleanSocialMedia = void 0;
function cleanSocialMedia(data) {
    var _a, _b, _c, _d;
    return {
        discord: ((_b = (_a = data === null || data === void 0 ? void 0 : data.socialMedia) === null || _a === void 0 ? void 0 : _a.links) === null || _b === void 0 ? void 0 : _b.DISCORD) || null,
        forums: ((_d = (_c = data === null || data === void 0 ? void 0 : data.socialMedia) === null || _c === void 0 ? void 0 : _c.links) === null || _d === void 0 ? void 0 : _d.HYPIXEL) || null
    };
}
exports.cleanSocialMedia = cleanSocialMedia;
