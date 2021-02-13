"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseSocialMedia = void 0;
function parseSocialMedia(socialMedia) {
    return {
        discord: socialMedia?.links?.DISCORD || null,
        forums: socialMedia?.links?.HYPIXEL || null
    };
}
exports.parseSocialMedia = parseSocialMedia;
