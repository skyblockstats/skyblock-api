"use strict";
/**
 * Random utility functions that are not related to Hypixel
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.sleep = exports.colorCodeFromName = exports.minecraftColorCodes = exports.shuffle = exports.jsonToQuery = exports.queryToJson = exports.undashUuid = void 0;
function undashUuid(uuid) {
    return uuid.replace(/-/g, '').toLowerCase();
}
exports.undashUuid = undashUuid;
function queryToJson(queryString) {
    const query = {};
    const pairs = (queryString[0] === '?' ? queryString.substr(1) : queryString).split('&');
    for (let i = 0; i < pairs.length; i++) {
        const pair = pairs[i].split('=');
        query[decodeURIComponent(pair[0])] = decodeURIComponent(pair[1] || '');
    }
    return query;
}
exports.queryToJson = queryToJson;
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
