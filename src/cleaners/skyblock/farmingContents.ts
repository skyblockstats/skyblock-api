import typedHypixelApi from 'typed-hypixel-api'

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

export function cleanFarmingContests(data: typedHypixelApi.SkyBlockProfileMember): FarmingContests {
    if (!data.jacob2) return {
        talkedToJacob: false,
        list: []
    }

    const contestsByDate: Record<string, PlayerFarmingContestStats['crops']> = {}
    for (const [contestName, contestData] of Object.entries(data.jacob2?.contests ?? {})) {
        const [year, monthDay, item] = contestName.split(':')
        const [month, day] = monthDay.split('_')
        const contestByDateKey = `${year}:${month}:${day}`
        const cropData: PlayerFarmingContestStats['crops'][number] = {
            item,
            amount: contestData.collected,
            // the api returns the position 0-indexed, so we add 1
            position: contestData.claimed_position ? contestData.claimed_position + 1 : null,
            claimed: contestData.claimed_rewards ?? null,
            participants: contestData.claimed_participants ?? null
        }
        if (!(contestByDateKey in contestsByDate))
            contestsByDate[contestByDateKey] = [cropData]
        else
            contestsByDate[contestByDateKey].push(cropData)
    }

    const contests: PlayerFarmingContestStats[] = Object.entries(contestsByDate).map(([contestDateKey, crops]) => {
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