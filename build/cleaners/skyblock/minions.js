"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.combineMinionArrays = exports.cleanMinions = void 0;
const hypixel_1 = require("../../hypixel");
/**
 * Clean the minions provided by Hypixel
 * @param minionsRaw The minion data provided by the Hypixel API
 */
function cleanMinions(minionsRaw) {
    const minions = [];
    for (const minionRaw of minionsRaw !== null && minionsRaw !== void 0 ? minionsRaw : []) {
        // do some regex magic to get the minion name and level
        // examples of potential minion names: CLAY_11, PIG_1, MAGMA_CUBE_4
        const minionName = minionRaw.split(/_\d/)[0].toLowerCase();
        const minionLevel = parseInt(minionRaw.split(/\D*_/)[1]);
        let matchingMinion = minions.find(m => m.name === minionName);
        if (!matchingMinion) {
            // if the minion doesnt already exist in the minions array, then create it
            matchingMinion = {
                name: minionName,
                levels: new Array(hypixel_1.maxMinion).fill(false)
            };
            minions.push(matchingMinion);
        }
        while (minionLevel > matchingMinion.levels.length)
            // if hypixel increases the minion level, this will increase with it
            matchingMinion.levels.push(false);
        // set the minion at that level to true
        matchingMinion.levels[minionLevel - 1] = true;
    }
    return minions;
}
exports.cleanMinions = cleanMinions;
/**
 * Combine multiple arrays of minions into one, useful when getting the minions for members
 * @param minions An array of arrays of minions
 */
function combineMinionArrays(minions) {
    const resultMinions = [];
    for (const memberMinions of minions) {
        for (const minion of memberMinions) {
            // this is a reference, so we can directly modify the attributes for matchingMinionReference
            // and they'll be in the resultMinions array
            const matchingMinionReference = resultMinions.find(m => m.name === minion.name);
            if (!matchingMinionReference) {
                // if the minion name isn't already in the array, add it!
                resultMinions.push(minion);
            }
            else {
                // This should never happen, but in case the length of `minion.levels` is longer than
                // `matchingMinionReference.levels`, then it should be extended to be equal length
                while (matchingMinionReference.levels.length < minion.levels.length)
                    matchingMinionReference.levels.push(null);
                for (let i = 0; i < minion.levels.length; i++) {
                    if (minion.levels[i])
                        matchingMinionReference.levels[i] = true;
                }
            }
        }
    }
    return resultMinions;
}
exports.combineMinionArrays = combineMinionArrays;
