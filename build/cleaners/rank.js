"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cleanRank = void 0;
const util_1 = require("../util");
const rankColors = {
    'NONE': '7',
    'VIP': 'a',
    'VIP+': 'a',
    'MVP': 'b',
    'MVP+': 'b',
    'MVP++': '6',
    'YOUTUBE': 'c',
    'HELPER': '9',
    'MODERATOR': '2',
    'GM': '2',
    'ADMIN': 'c'
};
/** Response cleaning (reformatting to be nicer) */
function cleanRank({ packageRank, newPackageRank, monthlyPackageRank, rankPlusColor, rank, prefix }) {
    var _a;
    let name;
    let color;
    let colored;
    if (prefix) { // derive values from prefix
        colored = prefix;
        color = util_1.minecraftColorCodes[colored.match(/§./)[0][1]];
        name = colored.replace(/§./g, '').replace(/[\[\]]/g, '');
    }
    else {
        if (monthlyPackageRank && monthlyPackageRank !== 'NONE')
            name = monthlyPackageRank;
        else if (rank && rank !== 'NORMAL')
            name = rank;
        else
            name = (_a = newPackageRank === null || newPackageRank === void 0 ? void 0 : newPackageRank.replace('_PLUS', '+')) !== null && _a !== void 0 ? _a : packageRank === null || packageRank === void 0 ? void 0 : packageRank.replace('_PLUS', '+');
        // MVP++ is called Superstar for some reason
        if (name === 'SUPERSTAR')
            name = 'MVP++';
        // YouTube rank is called YouTuber, change this to the proper name
        else if (name === 'YOUTUBER')
            name = 'YOUTUBE';
        else if (name === 'GAME_MASTER')
            name = 'GM';
        else if (name === undefined)
            name = 'NONE';
        const plusColor = rankPlusColor ? util_1.colorCodeFromName(rankPlusColor) : null;
        color = util_1.minecraftColorCodes[rankColors[name]];
        const rankColorPrefix = rankColors[name] ? '§' + rankColors[name] : '';
        const nameWithoutPlus = name.split('+')[0];
        const plusesInName = '+'.repeat(name.split('+').length - 1);
        if (plusColor && plusesInName.length >= 1)
            colored = `${rankColorPrefix}[${nameWithoutPlus}§${plusColor}${plusesInName}${rankColorPrefix}]`;
        else if (name !== 'NONE')
            colored = `${rankColorPrefix}[${name}]`;
        else
            // nons don't have a prefix
            colored = `${rankColorPrefix}`;
    }
    return {
        name,
        color,
        colored
    };
}
exports.cleanRank = cleanRank;
