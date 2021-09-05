export function cleanSocialMedia(data) {
    return {
        discord: data?.socialMedia?.links?.DISCORD || null,
        forums: data?.socialMedia?.links?.HYPIXEL || null
    };
}
