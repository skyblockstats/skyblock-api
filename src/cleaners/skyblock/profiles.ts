import { HypixelPlayerStatsSkyBlockProfiles } from '../../hypixelApi.js'
import {
    CleanBasicProfile,
    CleanFullProfile,
    CleanProfile,
    cleanSkyblockProfileResponse
} from './profile.js'

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
    const promises: Promise<CleanProfile | CleanFullProfile | null>[] = []
    for (const profile of data ?? []) {
        // let cleanedProfile = await cleanSkyblockProfileResponseLighter(profile)
        promises.push(cleanSkyblockProfileResponse(profile))
    }
    const cleanedProfiles: CleanProfile[] = (await Promise.all(promises)).filter(p => p) as CleanProfile[]
    return cleanedProfiles
}
