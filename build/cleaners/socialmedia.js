"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseSocialMedia = void 0;
function parseSocialMedia(socialMedia) {
    var _a, _b;
    return {
        discord: ((_a = socialMedia === null || socialMedia === void 0 ? void 0 : socialMedia.links) === null || _a === void 0 ? void 0 : _a.DISCORD) || null,
        forums: ((_b = socialMedia === null || socialMedia === void 0 ? void 0 : socialMedia.links) === null || _b === void 0 ? void 0 : _b.HYPIXEL) || null
    };
}
exports.parseSocialMedia = parseSocialMedia;
