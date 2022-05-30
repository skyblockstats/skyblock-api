import typedHypixelApi from 'typed-hypixel-api'
import * as constants from '../../constants.js'

export interface CleanMinion {
    name: string,
    levels: boolean[]
}


/**
 * Clean the minions provided by Hypixel
 * @param minionsRaw The minion data provided by the Hypixel API
 */
export async function cleanMinions(member: typedHypixelApi.SkyBlockProfileMember): Promise<CleanMinion[]> {
    const minions: CleanMinion[] = []
    const processedMinionIds: Set<string> = new Set()

    const maxMinionTiers = await constants.fetchMaxMinionTiers()
    let updatedMaxMinionTiers = false

    for (const minionRaw of member?.crafted_generators ?? []) {
        // do some regex magic to get the minion name and level
        // examples of potential minion names: CLAY_11, PIG_1, MAGMA_CUBE_4
        const minionId = minionRaw.split(/_\d/)[0].toLowerCase()
        const minionLevel = parseInt(minionRaw.split(/\D*_/)[1])

        if (minionLevel > (maxMinionTiers[minionId] ?? -1)) {
            maxMinionTiers[minionId] = minionLevel
            updatedMaxMinionTiers = true
        }

        let matchingMinion = minions.find(m => m.name === minionId)
        if (!matchingMinion) {
            // if the minion doesnt already exist in the minions array, then create it
            matchingMinion = {
                name: minionId,
                levels: new Array(maxMinionTiers[minionId]).fill(false)
            }
            minions.push(matchingMinion)
        }
        while (minionLevel > matchingMinion.levels.length)
            // if hypixel increases the minion level, this will increase with it
            matchingMinion.levels.push(false)

        // set the minion at that level to true
        matchingMinion.levels[minionLevel - 1] = true
        processedMinionIds.add(minionId)
    }

    const allMinionNames = new Set(await constants.fetchMinions())

    for (const minionName of processedMinionIds) {
        if (!allMinionNames.has(minionName)) {
            constants.addMinions(Array.from(processedMinionIds))
            break
        }
    }

    for (const minionId of allMinionNames) {
        if (!processedMinionIds.has(minionId)) {
            processedMinionIds.add(minionId)
            minions.push({
                name: minionId,
                levels: new Array(maxMinionTiers[minionId]).fill(false)
            })
        }
    }

    if (updatedMaxMinionTiers) {
        await constants.addMaxMinionTiers(maxMinionTiers)
    }

    minions.sort((a, b) => a.name > b.name ? 1 : (a.name < b.name ? -1 : 0))

    return minions
}

/**
 * Combine multiple arrays of minions into one, useful when getting the minions for members
 * @param minions An array of arrays of minions
 */
export function combineMinionArrays(minions: CleanMinion[][]): CleanMinion[] {
    const resultMinions: CleanMinion[] = []

    for (const memberMinions of minions) {
        for (const minion of memberMinions) {
            // this is a reference, so we can directly modify the attributes for matchingMinionReference
            // and they'll be in the resultMinions array
            const matchingMinionReference = resultMinions.find(m => m.name === minion.name)
            if (!matchingMinionReference) {
                // if the minion name isn't already in the array, add it!
                resultMinions.push(minion)
            } else {

                // This should never happen, but in case the length of `minion.levels` is longer than
                // `matchingMinionReference.levels`, then it should be extended to be equal length
                while (matchingMinionReference.levels.length < minion.levels.length)
                    matchingMinionReference.levels.push(false)

                for (let i = 0; i < minion.levels.length; i++) {
                    if (minion.levels[i])
                        matchingMinionReference.levels[i] = true
                }
            }
        }
    }

    return resultMinions
}

export function countUniqueMinions(minions: CleanMinion[]): number {
    let uniqueMinions: number = 0
    for (const minion of minions) {
        // find the number of times `true` is in the list and add it to uniqueMinions
        uniqueMinions += minion.levels.filter(x => x).length
    }
    return uniqueMinions
}
