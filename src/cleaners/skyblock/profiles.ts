import { CleanBasicProfile, CleanProfile, cleanSkyblockProfileResponse } from "./profile"
import { HypixelPlayerStatsSkyBlockProfiles } from "../../hypixelApi"

export function cleanPlayerSkyblockProfiles(rawProfiles: HypixelPlayerStatsSkyBlockProfiles): CleanBasicProfile[] {
    let profiles: CleanBasicProfile[] = []
    for (const profile of Object.values(rawProfiles ?? {})) {
        profiles.push({
            uuid: profile.profile_id,
            name: profile.cute_name
        })
    }
    return profiles
}

/** Convert an array of raw profiles into clean profiles */
export async function cleanSkyblockProfilesResponse(data: any[]): Promise<CleanProfile[]> {
    const promises = []
    for (const profile of data ?? []) {
        promises.push(cleanSkyblockProfileResponse(profile))
    }
    const cleanedProfiles: CleanProfile[] = await Promise.all(promises)
    return cleanedProfiles
}
