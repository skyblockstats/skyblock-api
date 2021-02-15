import { HypixelPlayerSocialMedia } from "../hypixelApi";

export interface CleanSocialMedia {
	discord: string | null
	forums: string | null
}

export function cleanSocialMedia(data): CleanSocialMedia {
    return {
        discord: data?.socialMedia?.links?.DISCORD || null,
        forums: data?.socialMedia?.links?.HYPIXEL || null
    }
}

