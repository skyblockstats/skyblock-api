import { HypixelPlayerStatsSkyBlockProfiles } from '../../hypixelApi'
import {
    CleanBasicProfile,
    CleanFullProfile,
    CleanProfile,
    cleanSkyblockProfileResponse
} from './profile'

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
    const promises: Promise<CleanProfile | CleanFullProfile>[] = []
    for (const profile of data ?? []) {
        promises.push(cleanSkyblockProfileResponse(profile))
    }
    const cleanedProfiles: CleanProfile[] = await Promise.all(promises)
    return cleanedProfiles
}
