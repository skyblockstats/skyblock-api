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
exports.fetchMemberProfile = exports.cleanSkyblockProfileResponse = exports.cleanSkyblockProfileResponseLighter = void 0;
const member_1 = require("./member");
const minions_1 = require("./minions");
const cached = __importStar(require("../../hypixelCached"));
const bank_1 = require("./bank");
/** Return a `CleanProfile` instead of a `CleanFullProfile`, useful when we need to get members but don't want to waste much ram */
async function cleanSkyblockProfileResponseLighter(data) {
    // We use Promise.all so it can fetch all the usernames at once instead of waiting for the previous promise to complete
    const promises = [];
    for (const memberUUID in data.members) {
        const memberRaw = data.members[memberUUID];
        memberRaw.uuid = memberUUID;
        // we pass an empty array to make it not check stats
        promises.push(member_1.cleanSkyBlockProfileMemberResponse(memberRaw, []));
    }
    const cleanedMembers = await Promise.all(promises);
    return {
        uuid: data.profile_id,
        name: data.cute_name,
        members: cleanedMembers,
    };
}
exports.cleanSkyblockProfileResponseLighter = cleanSkyblockProfileResponseLighter;
/** This function is somewhat costly and shouldn't be called often. Use cleanSkyblockProfileResponseLighter if you don't need all the data */
async function cleanSkyblockProfileResponse(data) {
    const cleanedMembers = [];
    for (const memberUUID in data.members) {
        const memberRaw = data.members[memberUUID];
        memberRaw.uuid = memberUUID;
        const member = await member_1.cleanSkyBlockProfileMemberResponse(memberRaw, ['stats']);
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
        minions
    };
}
exports.cleanSkyblockProfileResponse = cleanSkyblockProfileResponse;
// TODO: this should be moved and split up
/**
 * Fetch a CleanMemberProfile from a user and string
 * This is safe to use many times as the results are cached!
 * @param user A username or uuid
 * @param profile A profile name or profile uuid
 */
async function fetchMemberProfile(user, profile) {
    const playerUuid = await cached.uuidFromUser(user);
    const profileUuid = await cached.fetchProfileUuid(user, profile);
    const player = await cached.fetchPlayer(playerUuid);
    const cleanProfile = await cached.fetchProfile(playerUuid, profileUuid);
    const member = cleanProfile.members.find(m => m.uuid === playerUuid);
    return {
        member: {
            profileName: cleanProfile.name,
            first_join: member.first_join,
            last_save: member.last_save,
            // add all other data relating to the hypixel player, such as username, rank, etc
            ...player
        },
        profile: {
            uuid: cleanProfile.uuid,
            bank: cleanProfile.bank,
            minions: cleanProfile.minions,
        }
    };
}
exports.fetchMemberProfile = fetchMemberProfile;
