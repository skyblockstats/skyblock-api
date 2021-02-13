import { CleanSocialMedia, parseSocialMedia } from './socialmedia'
import { CleanRank, parseRank } from './rank'
import { HypixelPlayer } from '../hypixelApi'
import { undashUuid } from '../util'
import { CleanBasicProfile } from './skyblock/profile'
import { cleanPlayerSkyblockProfiles } from './skyblock/profiles'

export interface CleanBasicPlayer {
    uuid: string
    username: string
}

export interface CleanPlayer extends CleanBasicPlayer {
    rank: CleanRank
    socials: CleanSocialMedia
    profiles?: CleanBasicProfile[]
}

export async function cleanPlayerResponse(data: HypixelPlayer): Promise<CleanPlayer> {
    // Cleans up a 'player' api response
    console.log('cleanPlayerResponse', data.stats.SkyBlock.profiles)
    return {
        uuid: undashUuid(data.uuid),
        username: data.displayname,
        rank: parseRank(data),
        socials: parseSocialMedia(data.socialMedia),
        profiles: cleanPlayerSkyblockProfiles(data.stats.SkyBlock.profiles)
    }
}
