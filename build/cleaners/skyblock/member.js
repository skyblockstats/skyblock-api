"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.cleanSkyBlockProfileMemberResponse = void 0;
const cached = __importStar(require("../../hypixelCached"));
const fairysouls_1 = require("./fairysouls");
const minions_1 = require("./minions");
const stats_1 = require("./stats");
/** Cleans up a member (from skyblock/profile) */
async function cleanSkyBlockProfileMemberResponse(member, included = null) {
    // profiles.members[]
    const statsIncluded = included == null || included.includes('stats');
    return {
        uuid: member.uuid,
        username: await cached.usernameFromUser(member.uuid),
        last_save: member.last_save,
        first_join: member.first_join,
        // last_death: ??? idk how this is formatted,
        stats: statsIncluded ? stats_1.cleanProfileStats(member === null || member === void 0 ? void 0 : member.stats) : undefined,
        minions: statsIncluded ? minions_1.cleanMinions(member) : undefined,
        fairy_souls: statsIncluded ? fairysouls_1.cleanFairySouls(member) : undefined
    };
}
exports.cleanSkyBlockProfileMemberResponse = cleanSkyBlockProfileMemberResponse;
