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
const cached = __importStar(require("../../hypixelCached"));
const fairysouls_1 = require("./fairysouls");
const inventory_1 = require("./inventory");
const minions_1 = require("./minions");
const objectives_1 = require("./objectives");
const stats_1 = require("./stats");
async function cleanSkyBlockProfileMemberResponseBasic(member, included = null) {
    return {
        uuid: member.uuid,
        username: await cached.usernameFromUser(member.uuid),
        last_save: member.last_save,
        first_join: member.first_join,
    };
}
exports.cleanSkyBlockProfileMemberResponseBasic = cleanSkyBlockProfileMemberResponseBasic;
/** Cleans up a member (from skyblock/profile) */
async function cleanSkyBlockProfileMemberResponse(member, included = null) {
    // profiles.members[]
    const inventoriesIncluded = included == null || included.includes('inventories');
    return {
        uuid: member.uuid,
        username: await cached.usernameFromUser(member.uuid),
        last_save: member.last_save,
        first_join: member.first_join,
        stats: stats_1.cleanProfileStats(member),
        minions: minions_1.cleanMinions(member),
        fairy_souls: fairysouls_1.cleanFairySouls(member),
        inventories: inventoriesIncluded ? await inventory_1.cleanInventories(member) : undefined,
        objectives: objectives_1.cleanObjectives(member),
    };
}
exports.cleanSkyBlockProfileMemberResponse = cleanSkyBlockProfileMemberResponse;
