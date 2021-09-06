import { cleanPlayerSkyblockProfiles } from './skyblock/profiles.js';
import { cleanSocialMedia } from './socialmedia.js';
import { cleanRank } from './rank.js';
import { undashUuid } from '../util.js';
export async function cleanPlayerResponse(data) {
    // Cleans up a 'player' api response
    if (!data)
        return null; // bruh
    return {
        uuid: undashUuid(data.uuid),
        username: data.displayname,
        rank: cleanRank(data),
        socials: cleanSocialMedia(data),
        // first_join: data.firstLogin / 1000,
        profiles: cleanPlayerSkyblockProfiles(data.stats?.SkyBlock?.profiles)
    };
}
