import { cleanPlayerSkyblockProfiles } from './skyblock/profiles.js'
import { cleanSocialMedia, CleanSocialMedia } from './socialmedia.js'
import { CleanBasicProfile } from './skyblock/profile.js'
import { cleanRank, CleanRank } from './rank.js'
import typedHypixelApi from 'typed-hypixel-api'
import { undashUuid } from '../util.js'

export interface CleanBasicPlayer {
    uuid: string
    username: string
}

export interface CleanPlayer extends CleanBasicPlayer {
    rank: CleanRank
    socials: CleanSocialMedia
    profiles?: CleanBasicProfile[]
}

export async function cleanPlayerResponse(data: typedHypixelApi.PlayerDataResponse['player']): Promise<CleanPlayer | null> {
    // Cleans up a 'player' api response
    if (!data)
        return null // bruh
    return {
        uuid: undashUuid(data.uuid),
        username: data.displayname,
        rank: cleanRank(data),
        socials: cleanSocialMedia(data),
        profiles: cleanPlayerSkyblockProfiles(data.stats?.SkyBlock?.profiles)
    }
}
