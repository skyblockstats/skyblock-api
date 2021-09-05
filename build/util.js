"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractItemTier = exports.replaceDifferencesWithQuestionMark = exports.isUuid = exports.sleep = exports.colorCodeFromName = exports.minecraftColorCodes = exports.shuffle = exports.jsonToQuery = exports.undashUuid = void 0;
const fast_myers_diff_1 = require("fast-myers-diff");
/**
 * Random utility functions that are not related to Hypixel
 */
function undashUuid(uuid) {
    return uuid.replace(/-/g, '').toLowerCase();
}
exports.undashUuid = undashUuid;
function jsonToQuery(data) {
    return Object.entries(data || {}).map(e => e.join('=')).join('&');
}
exports.jsonToQuery = jsonToQuery;
function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}
exports.shuffle = shuffle;
exports.minecraftColorCodes = {
    '0': '#000000',
    '1': '#0000be',
    '2': '#00be00',
    '3': '#00bebe',
    '4': '#be0000',
    '5': '#be00be',
    '6': '#ffaa00',
    '7': '#bebebe',
    '8': '#3f3f3f',
    '9': '#3f3ffe',
    'a': '#3ffe3f',
    'b': '#3ffefe',
    'c': '#fe3f3f',
    'd': '#fe3ffe',
    'e': '#fefe3f',
    'f': '#ffffff',
    'black': '#000000',
    'dark_blue': '#0000be',
    'dark_green': '#00be00',
    'dark_aqua': '#00bebe',
    'dark_red': '#be0000',
    'dark_purple': '#be00be',
    'gold': '#ffaa00',
    'gray': '#bebebe',
    'dark_gray': '#3f3f3f',
    'blue': '#3f3ffe',
    'green': '#3ffe3f',
    'aqua': '#3ffefe',
    'red': '#fe3f3f',
    'light_purple': '#fe3ffe',
    'yellow': '#fefe3f',
    'white': '#ffffff',
};
/**
 * Converts a color name to the code
 * For example: blue -> 9
 * @param colorName The name of the color (blue, red, aqua, etc)
 */
function colorCodeFromName(colorName) {
    const hexColor = exports.minecraftColorCodes[colorName.toLowerCase()];
    for (const key in exports.minecraftColorCodes) {
        const value = exports.minecraftColorCodes[key];
        if (key.length === 1 && value === hexColor)
            return key;
    }
}
exports.colorCodeFromName = colorCodeFromName;
async function sleep(ms) {
    await new Promise(resolve => setTimeout(resolve, ms));
}
exports.sleep = sleep;
/** Returns whether a string is a UUID4 (Minecraft uuid) */
function isUuid(string) {
    return undashUuid(string).length === 32;
}
exports.isUuid = isUuid;
function replaceDifferencesWithQuestionMark(string1, string2) {
    const string1split = string1.replace(/(§.|[^\w? ])/gi, ' $1 ').split(' ');
    const string2split = string2.replace(/(§.|[^\w? ])/gi, ' $1 ').split(' ');
    let result = string1split.slice(); // this will be modified, and we slice to clone it
    let resultOffset = 0;
    const patch = (0, fast_myers_diff_1.diff)(string1split, string2split);
    for (const [removeStart, removeEnd, insertStart, insertEnd] of patch) {
        const replace = string1split.slice(removeStart, removeEnd).join(' ').replace(/ (§.|[^\w? ]) /gi, '$1');
        const replaceWith = string2split.slice(insertStart, insertEnd).join(' ').replace(/ (§.|[^\w? ]) /gi, '$1');
        result.splice(resultOffset + removeStart, removeEnd - removeStart, ...(Math.min(replace.length, replaceWith.length) > 0 ? ['?'.repeat(Math.min(replace.length, replaceWith.length))] : []));
        resultOffset += (Math.min(replace.length, replaceWith.length) > 0 ? 1 : 0) - (removeEnd - removeStart);
    }
    return result.join(' ').replace(/ (§.|[^\w? ]) /gi, '$1');
}
exports.replaceDifferencesWithQuestionMark = replaceDifferencesWithQuestionMark;
/** Extract the tier of the item from the lore, or return null if it can't find it */
function extractItemTier(lore) {
    var _a;
    let lastLoreLine = lore[lore.length - 1];
    // if the last line just doesn't exist, return nul
    if (!lastLoreLine)
        return null;
    lastLoreLine = lastLoreLine.replace(/§k.+?§r/g, '').replace(/§./g, '').trim();
    // if the last line is empty, return null
    if (!lastLoreLine)
        return null;
    const tierFirstWord = (_a = lastLoreLine.split(' ')[0]) !== null && _a !== void 0 ? _a : null;
    if (tierFirstWord === 'VERY')
        return 'VERY SPECIAL'; // hopefully they don't add more two word tiers
    else
        return tierFirstWord;
}
exports.extractItemTier = extractItemTier;
