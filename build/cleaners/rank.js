"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseRank = void 0;
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
    'ADMIN': 'c'
};
/** Response cleaning (reformatting to be nicer) */
function parseRank({ packageRank, newPackageRank, monthlyPackageRank, rankPlusColor, rank, prefix }) {
    let name;
    let color;
    let colored;
    if (prefix) { // derive values from prefix
        colored = prefix;
        color = util_1.minecraftColorCodes[colored.match(/§./)[0][1]];
        name = colored.replace(/§./g, '').replace(/[\[\]]/g, '');
    }
    else {
        name = rank
            || newPackageRank.replace('_PLUS', '+')
            || packageRank.replace('_PLUS', '+')
            || monthlyPackageRank;
        // MVP++ is called Superstar for some reason
        if (name === 'SUPERSTAR')
            name = 'MVP++';
        // YouTube rank is called YouTuber, change this to the proper name
        else if (name === 'YOUTUBER')
            name = 'YOUTUBE';
        const plusColor = util_1.colorCodeFromName(rankPlusColor);
        color = util_1.minecraftColorCodes[rankColors[name]];
        const rankColorPrefix = rankColors[name] ? '§' + rankColors[name] : '';
        const nameWithoutPlus = name.split('+')[0];
        const plusesInName = '+'.repeat(name.split('+').length - 1);
        if (plusColor && plusesInName.length >= 1)
            colored = `${rankColorPrefix}[${nameWithoutPlus}§${plusColor}${plusesInName}${rankColorPrefix}]`;
        else
            colored = `${rankColorPrefix}[${name}]`;
    }
    return {
        name,
        color,
        colored
    };
}
exports.parseRank = parseRank;
