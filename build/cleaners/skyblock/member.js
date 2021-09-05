import { cleanCollections } from './collections';
import { cleanInventories } from './inventory';
import { cleanFairySouls } from './fairysouls';
import { cleanObjectives } from './objectives';
import { cleanProfileStats } from './stats';
import { cleanMinions } from './minions';
import { cleanSlayers } from './slayers';
import { cleanVisitedZones } from './zones';
import { cleanSkills } from './skills';
import * as cached from '../../hypixelCached';
import * as constants from '../../constants';
export async function cleanSkyBlockProfileMemberResponseBasic(member) {
    const player = await cached.fetchPlayer(member.uuid);
    if (!player)
        return null;
    return {
        uuid: member.uuid,
        username: player.username,
        last_save: member.last_save / 1000,
        first_join: member.first_join / 1000,
        rank: player.rank
    };
}
/** Cleans up a member (from skyblock/profile) */
export async function cleanSkyBlockProfileMemberResponse(member, included = undefined) {
    // profiles.members[]
    const inventoriesIncluded = included === undefined || included.includes('inventories');
    const player = await cached.fetchPlayer(member.uuid);
    if (!player)
        return null;
    const fairySouls = cleanFairySouls(member);
    const { max_fairy_souls: maxFairySouls } = await constants.fetchConstantValues();
    if (fairySouls.total > (maxFairySouls ?? 0))
        await constants.setConstantValues({ max_fairy_souls: fairySouls.total });
    return {
        uuid: member.uuid,
        username: player.username,
        last_save: member.last_save / 1000,
        first_join: member.first_join / 1000,
        rank: player.rank,
        purse: member.coin_purse,
        stats: cleanProfileStats(member),
        // this is used for leaderboards
        rawHypixelStats: member.stats ?? {},
        minions: await cleanMinions(member),
        fairy_souls: fairySouls,
        inventories: inventoriesIncluded ? await cleanInventories(member) : undefined,
        objectives: cleanObjectives(member),
        skills: await cleanSkills(member),
        visited_zones: cleanVisitedZones(member),
        collections: cleanCollections(member),
        slayers: cleanSlayers(member)
    };
}
