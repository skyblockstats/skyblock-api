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
exports.cleanSkyblockProfileResponse = exports.cleanSkyblockProfileResponseLighter = void 0;
const member_1 = require("./member");
const minions_1 = require("./minions");
const bank_1 = require("./bank");
const constants = __importStar(require("../../constants"));
/** Return a `CleanProfile` instead of a `CleanFullProfile`, useful when we need to get members but don't want to waste much ram */
async function cleanSkyblockProfileResponseLighter(data) {
    // We use Promise.all so it can fetch all the usernames at once instead of waiting for the previous promise to complete
    const promises = [];
    for (const memberUUID in data.members) {
        const memberRaw = data.members[memberUUID];
        memberRaw.uuid = memberUUID;
        // we pass an empty array to make it not check stats
        promises.push(member_1.cleanSkyBlockProfileMemberResponseBasic(memberRaw));
    }
    const cleanedMembers = (await Promise.all(promises)).filter(m => m);
    return {
        uuid: data.profile_id,
        name: data.cute_name,
        members: cleanedMembers,
    };
}
exports.cleanSkyblockProfileResponseLighter = cleanSkyblockProfileResponseLighter;
/**
 * This function is somewhat costly and shouldn't be called often. Use cleanSkyblockProfileResponseLighter if you don't need all the data
 */
async function cleanSkyblockProfileResponse(data, options) {
    // We use Promise.all so it can fetch all the users at once instead of waiting for the previous promise to complete
    const promises = [];
    for (const memberUUID in data.members) {
        const memberRaw = data.members[memberUUID];
        memberRaw.uuid = memberUUID;
        promises.push(member_1.cleanSkyBlockProfileMemberResponse(memberRaw, [
            !(options === null || options === void 0 ? void 0 : options.basic) ? 'stats' : undefined,
            (options === null || options === void 0 ? void 0 : options.mainMemberUuid) === memberUUID ? 'inventories' : undefined
        ]));
    }
    const cleanedMembers = (await Promise.all(promises)).filter(m => m !== null && m !== undefined);
    if (options === null || options === void 0 ? void 0 : options.basic) {
        return {
            uuid: data.profile_id,
            name: data.cute_name,
            members: cleanedMembers,
        };
    }
    const memberMinions = [];
    for (const member of cleanedMembers) {
        memberMinions.push(member.minions);
    }
    const minions = minions_1.combineMinionArrays(memberMinions);
    const { max_minions: maxUniqueMinions } = await constants.fetchConstantValues();
    const uniqueMinions = minions_1.countUniqueMinions(minions);
    if (uniqueMinions > (maxUniqueMinions !== null && maxUniqueMinions !== void 0 ? maxUniqueMinions : 0))
        await constants.setConstantValues({ max_minions: uniqueMinions });
    // return more detailed info
    return {
        uuid: data.profile_id,
        name: data.cute_name,
        members: cleanedMembers,
        bank: bank_1.cleanBank(data),
        minions: minions,
        minion_count: uniqueMinions
    };
}
exports.cleanSkyblockProfileResponse = cleanSkyblockProfileResponse;
