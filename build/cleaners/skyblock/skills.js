"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cleanSkills = exports.levelForSkillXp = void 0;
// the highest level you can have in each skill
// numbers taken from https://hypixel-skyblock.fandom.com/wiki/Skills
const skillsMaxLevel = {
    farming: 60,
    mining: 60,
    combat: 60,
    foraging: 50,
    fishing: 50,
    enchanting: 60,
    alchemy: 50,
    taming: 50,
    dungeoneering: 50,
    carpentry: 50,
    runecrafting: 25,
    social: 25
};
const skillXpTable = [
    50,
    175,
    375,
    675,
    1175,
    1925,
    2925,
    4425,
    6425,
    9925,
    14925,
    22425,
    32425,
    47425,
    67425,
    97425,
    147425,
    222425,
    322425,
    522425,
    822425,
    1222425,
    1722425,
    2322425,
    3022425,
    3822425,
    4722425,
    5722425,
    6822425,
    8022425,
    9322425,
    10722425,
    12222425,
    13822425,
    15522425,
    17322425,
    19222425,
    21222425,
    23322425,
    25522425,
    27822425,
    30222425,
    32722425,
    35322425,
    38072425,
    40972425,
    44072425,
    47472425,
    51172425,
    55172425,
    59472425,
    64072425,
    68972425,
    74172425,
    79672425,
    85472425,
    91572425,
    97972425,
    104672425,
    111672425 // 60
];
const skillXpTableEasier = [
    50,
    150,
    275,
    435,
    635,
    885,
    1200,
    1600,
    2100,
    2725,
    3510,
    4510,
    5760,
    7325,
    9325,
    11825,
    14950,
    18950,
    23950,
    30200,
    38050,
    47850,
    60100,
    75400,
    94450 // 25
];
// for skills that aren't in maxSkills, default to this
const skillsDefaultMaxLevel = 50;
/**
 * Get the skill level for the amount of total xp
 * @param xp The xp we're finding the level for
 * @param easierLevel Whether it should use the alternate leveling xp table (used for cosmetic skills and dungeoneering)
 */
function levelForSkillXp(xp, maxLevel) {
    const xpTable = (maxLevel <= 25 ? skillXpTableEasier : skillXpTable).slice(0, maxLevel);
    const skillLevel = [...xpTable].reverse().findIndex(levelXp => xp >= levelXp);
    return skillLevel === -1 ? 0 : xpTable.length - skillLevel;
}
exports.levelForSkillXp = levelForSkillXp;
async function cleanSkills(data) {
    var _a;
    const skills = [];
    for (const item in data) {
        if (item.startsWith('experience_skill_')) {
            const skillName = item.substr('experience_skill_'.length);
            // the amount of total xp you have in this skill
            const skillXp = data[item];
            const skillMaxLevel = (_a = skillsMaxLevel[skillName]) !== null && _a !== void 0 ? _a : skillsDefaultMaxLevel;
            const xpTable = (skillMaxLevel <= 25 ? skillXpTableEasier : skillXpTable).slice(0, skillMaxLevel);
            // the level you're at for this skill
            const skillLevel = levelForSkillXp(skillXp, skillMaxLevel);
            // the total xp required for the previous level
            const previousLevelXp = skillLevel >= 1 ? xpTable[skillLevel - 1] : 0;
            // the extra xp left over
            const skillLevelXp = skillXp - previousLevelXp;
            // the amount of extra xp required for this level
            const skillLevelXpRequired = xpTable[skillLevel] - previousLevelXp;
            skills.push({
                name: skillName,
                xp: skillXp,
                level: skillLevel,
                maxLevel: skillMaxLevel,
                levelXp: skillLevelXp,
                levelXpRequired: skillLevelXpRequired
            });
        }
    }
    return skills;
}
exports.cleanSkills = cleanSkills;
