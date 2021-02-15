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
exports.cleanSkyBlockProfileMemberResponse = exports.cleanSkyBlockProfileMemberResponseBasic = void 0;
const stats_1 = require("./stats");
const inventory_1 = require("./inventory");
const fairysouls_1 = require("./fairysouls");
const objectives_1 = require("./objectives");
const minions_1 = require("./minions");
const skills_1 = require("./skills");
const cached = __importStar(require("../../hypixelCached"));
const zones_1 = require("./zones");
const collections_1 = require("./collections");
const slayers_1 = require("./slayers");
async function cleanSkyBlockProfileMemberResponseBasic(member, included = null) {
    const player = await cached.fetchPlayer(member.uuid);
    return {
        uuid: member.uuid,
        username: player.username,
        last_save: member.last_save,
        first_join: member.first_join,
        rank: player.rank
    };
}
exports.cleanSkyBlockProfileMemberResponseBasic = cleanSkyBlockProfileMemberResponseBasic;
/** Cleans up a member (from skyblock/profile) */
async function cleanSkyBlockProfileMemberResponse(member, included = null) {
    // profiles.members[]
    const inventoriesIncluded = included == null || included.includes('inventories');
    const player = await cached.fetchPlayer(member.uuid);
    return {
        uuid: member.uuid,
        username: player.username,
        last_save: member.last_save,
        first_join: member.first_join,
        rank: player.rank,
        purse: member.coin_purse,
        stats: stats_1.cleanProfileStats(member),
        minions: minions_1.cleanMinions(member),
        fairy_souls: fairysouls_1.cleanFairySouls(member),
        inventories: inventoriesIncluded ? await inventory_1.cleanInventories(member) : undefined,
        objectives: objectives_1.cleanObjectives(member),
        skills: skills_1.cleanSkills(member),
        visited_zones: zones_1.cleanVisitedZones(member),
        collections: collections_1.cleanCollections(member),
        slayers: slayers_1.cleanSlayers(member)
    };
}
exports.cleanSkyBlockProfileMemberResponse = cleanSkyBlockProfileMemberResponse;
