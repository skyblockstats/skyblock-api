import { HypixelPlayerStatsSkyBlockProfiles } from "../../hypixelApi"
import { CleanBasicProfile, CleanProfile, cleanSkyblockProfileResponseLighter } from "./profile"

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
    const cleanedProfiles: CleanProfile[] = []
    for (const profile of data ?? []) {
        let cleanedProfile = await cleanSkyblockProfileResponseLighter(profile)
        cleanedProfiles.push(cleanedProfile)
    }
    return cleanedProfiles
}
