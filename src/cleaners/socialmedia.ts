import { HypixelPlayerSocialMedia } from "../hypixelApi";

export interface CleanSocialMedia {
	discord: string | null
	forums: string | null
}

export function parseSocialMedia(socialMedia: HypixelPlayerSocialMedia): CleanSocialMedia {
    return {
        discord: socialMedia?.links?.DISCORD || null,
        forums: socialMedia?.links?.HYPIXEL || null
    }
}

