import { cleanSkyBlockProfileMemberResponse, cleanSkyBlockProfileMemberResponseBasic } from './member.js';
import { combineMinionArrays, countUniqueMinions } from './minions.js';
import * as constants from '../../constants.js';
import { cleanBank } from './bank.js';
/** Return a `CleanProfile` instead of a `CleanFullProfile`, useful when we need to get members but don't want to waste much ram */
export async function cleanSkyblockProfileResponseLighter(data) {
    // We use Promise.all so it can fetch all the usernames at once instead of waiting for the previous promise to complete
    const promises = [];
    for (const memberUUID in data.members) {
        const memberRaw = data.members[memberUUID];
        memberRaw.uuid = memberUUID;
        // we pass an empty array to make it not check stats
        promises.push(cleanSkyBlockProfileMemberResponseBasic(memberRaw));
    }
    const cleanedMembers = (await Promise.all(promises)).filter(m => m);
    return {
        uuid: data.profile_id,
        name: data.cute_name,
        members: cleanedMembers,
    };
}
/**
 * This function is somewhat costly and shouldn't be called often. Use cleanSkyblockProfileResponseLighter if you don't need all the data
 */
export async function cleanSkyblockProfileResponse(data, options) {
    // We use Promise.all so it can fetch all the users at once instead of waiting for the previous promise to complete
    const promises = [];
    if (!data)
        return null;
    for (const memberUUID in data.members) {
        const memberRaw = data.members[memberUUID];
        memberRaw.uuid = memberUUID;
        promises.push(cleanSkyBlockProfileMemberResponse(memberRaw, [
            !options?.basic ? 'stats' : undefined,
            options?.mainMemberUuid === memberUUID ? 'inventories' : undefined
        ]));
    }
    const cleanedMembers = (await Promise.all(promises)).filter(m => m !== null && m !== undefined);
    if (options?.basic) {
        return {
            uuid: data.profile_id,
            name: data.cute_name,
            members: cleanedMembers,
        };
    }
    const memberMinions = [];
    for (const member of cleanedMembers) {
        memberMinions.push(member.minions);
    }
    const minions = combineMinionArrays(memberMinions);
    const { max_minions: maxUniqueMinions } = await constants.fetchConstantValues();
    const uniqueMinions = countUniqueMinions(minions);
    if (uniqueMinions > (maxUniqueMinions ?? 0))
        await constants.setConstantValues({ max_minions: uniqueMinions });
    // return more detailed info
    return {
        uuid: data.profile_id,
        name: data.cute_name,
        members: cleanedMembers,
        bank: cleanBank(data),
        minions: minions,
        minion_count: uniqueMinions
    };
}
