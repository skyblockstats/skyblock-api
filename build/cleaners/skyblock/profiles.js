import { cleanSkyblockProfileResponse } from './profile.js';
export function cleanPlayerSkyblockProfiles(rawProfiles) {
    let profiles = [];
    for (const profile of Object.values(rawProfiles ?? {})) {
        profiles.push({
            uuid: profile.profile_id,
            name: profile.cute_name
        });
    }
    return profiles;
}
/** Convert an array of raw profiles into clean profiles */
export async function cleanSkyblockProfilesResponse(data) {
    const promises = [];
    for (const profile of data ?? []) {
        // let cleanedProfile = await cleanSkyblockProfileResponseLighter(profile)
        promises.push(cleanSkyblockProfileResponse(profile));
    }
    const cleanedProfiles = (await Promise.all(promises)).filter(p => p);
    return cleanedProfiles;
}
