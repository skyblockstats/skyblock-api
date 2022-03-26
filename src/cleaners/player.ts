import { PlayerDataResponse as HypixelApiPlayerDataResponse } from 'typed-hypixel-api/build/responses/player'
import { cleanPlayerSkyblockProfiles } from './skyblock/profiles.js'
import { cleanSocialMedia, CleanSocialMedia } from './socialmedia.js'
import { CleanBasicProfile } from './skyblock/profile.js'
import { cleanRank, CleanRank } from './rank.js'
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

export async function cleanPlayerResponse(data: HypixelApiPlayerDataResponse['player']): Promise<CleanPlayer | null> {
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
