import { cleanPlayerSkyblockProfiles } from './skyblock/profiles'
import { cleanSocialMedia, CleanSocialMedia } from './socialmedia'
import { CleanBasicProfile } from './skyblock/profile'
import { cleanRank, CleanRank } from './rank'
import { HypixelPlayer } from '../hypixelApi'
import { undashUuid } from '../util'

export interface CleanBasicPlayer {
    uuid: string
    username: string
}

export interface CleanPlayer extends CleanBasicPlayer {
    rank: CleanRank
    socials: CleanSocialMedia
    profiles?: CleanBasicProfile[]
    first_join: number
}

export async function cleanPlayerResponse(data: HypixelPlayer): Promise<CleanPlayer> {
    // Cleans up a 'player' api response
    return {
        uuid: undashUuid(data.uuid),
        username: data.displayname,
        rank: cleanRank(data),
        socials: cleanSocialMedia(data),
        first_join: data.firstLogin / 1000,
        profiles: cleanPlayerSkyblockProfiles(data.stats?.SkyBlock?.profiles)
    }
}
