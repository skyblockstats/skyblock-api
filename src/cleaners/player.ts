import { cleanSocialMedia, CleanSocialMedia } from './socialmedia.js'
import { cleanPlayerSkyblockProfiles } from './skyblock/profiles.js'
import { cleanPlayerSkyblockClaimed } from './skyblock/claimed.js'
import { cleanPlayerAchievements, Achievements } from './achievements.js'
import { CleanBasicProfile } from './skyblock/profile.js'
import { cleanRank, CleanRank } from './rank.js'
import typedHypixelApi from 'typed-hypixel-api'
import { undashUuid } from '../util.js'

export interface CleanBasicPlayer {
    uuid: string
    username: string
}

export interface ClaimedSkyBlockItem {
    /**
     * name is kept for backwards compatibility, it will be changed to a more
     * human readable name later
     */
    name: string
    id: string
    timestamp: number
}

export interface CleanPlayer extends CleanBasicPlayer {
    rank: CleanRank
    socials: CleanSocialMedia
    profiles?: CleanBasicProfile[]
    claimed?: ClaimedSkyBlockItem[]
}

export interface CleanFullPlayer extends CleanPlayer {
    achievements: Achievements
}

export async function cleanPlayerResponse(data: typedHypixelApi.PlayerDataResponse['player']): Promise<CleanFullPlayer | null> {
    // Cleans up a 'player' api response
    if (!data)
        return null
    return {
        uuid: undashUuid(data.uuid),
        username: data.displayname,
        rank: cleanRank(data),
        socials: cleanSocialMedia(data),
        profiles: cleanPlayerSkyblockProfiles(data.stats?.SkyBlock?.profiles),
        claimed: cleanPlayerSkyblockClaimed(data),
        achievements: await cleanPlayerAchievements(data)
    }
}
