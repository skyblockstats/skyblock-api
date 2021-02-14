"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cleanSkyblockProfileResponse = exports.cleanSkyblockProfileResponseLighter = void 0;
const member_1 = require("./member");
const minions_1 = require("./minions");
const bank_1 = require("./bank");
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
    const cleanedMembers = await Promise.all(promises);
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
async function cleanSkyblockProfileResponse(data, { mainMemberUuid }) {
    const cleanedMembers = [];
    for (const memberUUID in data.members) {
        const memberRaw = data.members[memberUUID];
        memberRaw.uuid = memberUUID;
        const member = await member_1.cleanSkyBlockProfileMemberResponse(memberRaw, ['stats', mainMemberUuid === memberUUID ? 'inventories' : undefined]);
        cleanedMembers.push(member);
    }
    const memberMinions = [];
    for (const member of cleanedMembers) {
        memberMinions.push(member.minions);
    }
    const minions = minions_1.combineMinionArrays(memberMinions);
    // return more detailed info
    return {
        uuid: data.profile_id,
        name: data.cute_name,
        members: cleanedMembers,
        bank: bank_1.cleanBank(data),
        minions: minions,
        minion_count: minions_1.countUniqueMinions(minions)
    };
}
exports.cleanSkyblockProfileResponse = cleanSkyblockProfileResponse;
