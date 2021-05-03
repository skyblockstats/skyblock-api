"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.countUniqueMinions = exports.combineMinionArrays = exports.cleanMinions = void 0;
const hypixel_1 = require("../../hypixel");
const constants = __importStar(require("../../constants"));
/**
 * Clean the minions provided by Hypixel
 * @param minionsRaw The minion data provided by the Hypixel API
 */
async function cleanMinions(member) {
    var _a;
    const minions = [];
    const processedMinionNames = new Set();
    for (const minionRaw of (_a = member === null || member === void 0 ? void 0 : member.crafted_generators) !== null && _a !== void 0 ? _a : []) {
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
        processedMinionNames.add(minionName);
    }
    const allMinionNames = new Set(await constants.fetchMinions());
    for (const minionName of processedMinionNames) {
        if (!allMinionNames.has(minionName)) {
            constants.addMinions(Array.from(processedMinionNames));
            break;
        }
    }
    for (const minionName of allMinionNames) {
        if (!processedMinionNames.has(minionName)) {
            processedMinionNames.add(minionName);
            minions.push({
                name: minionName,
                levels: new Array(hypixel_1.maxMinion).fill(false)
            });
        }
    }
    return minions.sort((a, b) => a.name > b.name ? 1 : (a.name < b.name ? -1 : 0));
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
function countUniqueMinions(minions) {
    let uniqueMinions = 0;
    for (const minion of minions) {
        // find the number of times `true` is in the list and add it to uniqueMinions
        uniqueMinions += minion.levels.filter(x => x).length;
    }
    return uniqueMinions;
}
exports.countUniqueMinions = countUniqueMinions;
