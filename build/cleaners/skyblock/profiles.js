"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cleanSkyblockProfilesResponse = exports.cleanPlayerSkyblockProfiles = void 0;
const profile_1 = require("./profile");
function cleanPlayerSkyblockProfiles(rawProfiles) {
    let profiles = [];
    for (const profile of Object.values(rawProfiles !== null && rawProfiles !== void 0 ? rawProfiles : {})) {
        profiles.push({
            uuid: profile.profile_id,
            name: profile.cute_name
        });
    }
    return profiles;
}
exports.cleanPlayerSkyblockProfiles = cleanPlayerSkyblockProfiles;
/** Convert an array of raw profiles into clean profiles */
async function cleanSkyblockProfilesResponse(data) {
    const cleanedProfiles = [];
    for (const profile of data !== null && data !== void 0 ? data : []) {
        let cleanedProfile = await profile_1.cleanSkyblockProfileResponseLighter(profile);
        cleanedProfiles.push(cleanedProfile);
    }
    return cleanedProfiles;
}
exports.cleanSkyblockProfilesResponse = cleanSkyblockProfilesResponse;
