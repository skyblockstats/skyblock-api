import typedHypixelApi from 'typed-hypixel-api'
import { addCrops } from '../../constants.js'
import { cleanItemId } from './itemId.js'

export interface PlayerFarmingContestStats {
    year: number
    month: number
    day: number
    crops: {
        item: string
        amount: number
        /** The position (1-indexed) that the user got on the contest. */
        position: number | null
        /** Whether the player has claimed their rewards. */
        claimed: boolean | null
        /**
         * The number of people who participated in this contest.
         */
        participants: number | null
    }[]
}

export interface FarmingContests {
    talkedToJacob: boolean
    list: PlayerFarmingContestStats[]
}

export async function cleanFarmingContests(data: typedHypixelApi.SkyBlockProfileMember): Promise<FarmingContests> {
    if (!data.jacob2) return {
        talkedToJacob: false,
        list: []
    }

    let cropNames: Set<string> = new Set()

    const contestsByDate: Record<string, PlayerFarmingContestStats['crops']> = {}
    for (const [contestName, contestData] of Object.entries(data.jacob2?.contests ?? {})) {
        const [year, monthDay, item, itemDamage] = contestName.split(':')
        const [month, day] = monthDay.split('_')
        const contestByDateKey = `${year}:${month}:${day}`
        const cropId = cleanItemId(itemDamage !== undefined ? `${item}:${itemDamage}` : item)
        const cropData: PlayerFarmingContestStats['crops'][number] = {
            item: cropId,
            amount: contestData.collected,
            // the api returns the position 0-indexed, so we add 1
            position: contestData.claimed_position !== undefined ? contestData.claimed_position + 1 : null,
            claimed: contestData.claimed_rewards ?? null,
            participants: contestData.claimed_participants ?? null
        }
        cropNames.add(cropId)
        if (!(contestByDateKey in contestsByDate))
            contestsByDate[contestByDateKey] = [cropData]
        else
            contestsByDate[contestByDateKey].push(cropData)
    }

    await addCrops(Array.from(cropNames))

    const contestsByDateEntries = Object.entries(contestsByDate)
    // this is to sort by newest first
    contestsByDateEntries.reverse()

    const contests: PlayerFarmingContestStats[] = contestsByDateEntries.map(([contestDateKey, crops]) => {
        const [year, month, day] = contestDateKey.split(':')
        return {
            year: parseInt(year),
            month: parseInt(month),
            day: parseInt(day),
            crops
        }
    })

    return {
        talkedToJacob: data.jacob2?.talked ?? false,
        list: contests
    }
}