import { HypixelPlayerStatsSkyBlockProfiles } from '../../hypixelApi.js'
import {
    CleanBasicProfile,
    CleanFullProfile,
    cleanSkyblockProfileResponse
} from './profile.js'
import typedHypixelApi from 'typed-hypixel-api'
import { ApiOptions } from '../../hypixel.js'

export function cleanPlayerSkyblockProfiles(rawProfiles: HypixelPlayerStatsSkyBlockProfiles | undefined): CleanBasicProfile[] {
    if (!rawProfiles) return []

    let profiles: CleanBasicProfile[] = []
    for (const profile of Object.values(rawProfiles ?? {})) {
        profiles.push({
            uuid: profile.profile_id.replace(/-/g, ''),
            name: profile.cute_name
        })
    }
    return profiles
}

/** Convert an array of raw profiles into clean profiles */
export async function cleanSkyblockProfilesResponse(
    data: typedHypixelApi.SkyBlockProfilesResponse['profiles'],
    options: ApiOptions
): Promise<CleanFullProfile[] | null> {
    if (!data) return null

    const promises: Promise<CleanFullProfile | null>[] = []
    for (const profile of data) {
        promises.push(cleanSkyblockProfileResponse(profile, options))
    }
    const cleanedProfiles: CleanFullProfile[] = (await Promise.all(promises)).filter((p): p is CleanFullProfile => p !== null)
    return cleanedProfiles
}
