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
const collections_1 = require("./collections");
const inventory_1 = require("./inventory");
const fairysouls_1 = require("./fairysouls");
const objectives_1 = require("./objectives");
const stats_1 = require("./stats");
const minions_1 = require("./minions");
const slayers_1 = require("./slayers");
const zones_1 = require("./zones");
const skills_1 = require("./skills");
const cached = __importStar(require("../../hypixelCached"));
const constants = __importStar(require("../../constants"));
async function cleanSkyBlockProfileMemberResponseBasic(member) {
    const player = await cached.fetchPlayer(member.uuid);
    if (!player)
        return null;
    return {
        uuid: member.uuid,
        username: player.username,
        last_save: member.last_save / 1000,
        first_join: member.first_join / 1000,
        rank: player.rank
    };
}
exports.cleanSkyBlockProfileMemberResponseBasic = cleanSkyBlockProfileMemberResponseBasic;
/** Cleans up a member (from skyblock/profile) */
async function cleanSkyBlockProfileMemberResponse(member, included = undefined) {
    var _a;
    // profiles.members[]
    const inventoriesIncluded = included === undefined || included.includes('inventories');
    const player = await cached.fetchPlayer(member.uuid);
    if (!player)
        return null;
    const fairySouls = fairysouls_1.cleanFairySouls(member);
    const { max_fairy_souls: maxFairySouls } = await constants.fetchConstantValues();
    if (fairySouls.total > (maxFairySouls !== null && maxFairySouls !== void 0 ? maxFairySouls : 0))
        await constants.setConstantValues({ max_fairy_souls: fairySouls.total });
    return {
        uuid: member.uuid,
        username: player.username,
        last_save: member.last_save / 1000,
        first_join: member.first_join / 1000,
        rank: player.rank,
        purse: member.coin_purse,
        stats: stats_1.cleanProfileStats(member),
        // this is used for leaderboards
        rawHypixelStats: (_a = member.stats) !== null && _a !== void 0 ? _a : {},
        minions: await minions_1.cleanMinions(member),
        fairy_souls: fairySouls,
        inventories: inventoriesIncluded ? await inventory_1.cleanInventories(member) : undefined,
        objectives: objectives_1.cleanObjectives(member),
        skills: await skills_1.cleanSkills(member),
        visited_zones: zones_1.cleanVisitedZones(member),
        collections: collections_1.cleanCollections(member),
        slayers: slayers_1.cleanSlayers(member)
    };
}
exports.cleanSkyBlockProfileMemberResponse = cleanSkyBlockProfileMemberResponse;
