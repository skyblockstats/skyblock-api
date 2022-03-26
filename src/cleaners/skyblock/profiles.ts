import { HypixelPlayerStatsSkyBlockProfiles } from '../../hypixelApi.js'
import {
    CleanBasicProfile,
    CleanFullProfile,
    CleanProfile,
    cleanSkyblockProfileResponse
} from './profile.js'
import { SkyBlockProfilesResponse } from 'typed-hypixel-api/build/responses/skyblock/profiles'

export function cleanPlayerSkyblockProfiles(rawProfiles: HypixelPlayerStatsSkyBlockProfiles | undefined): CleanBasicProfile[] {
    if (!rawProfiles) return []

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
export async function cleanSkyblockProfilesResponse(data: SkyBlockProfilesResponse['profiles']): Promise<CleanFullProfile[]> {
    const promises: Promise<CleanFullProfile | null>[] = []
    for (const profile of data) {
        promises.push(cleanSkyblockProfileResponse(profile))
    }
    const cleanedProfiles: CleanFullProfile[] = (await Promise.all(promises)).filter((p): p is CleanFullProfile => p !== null)
    return cleanedProfiles
}
