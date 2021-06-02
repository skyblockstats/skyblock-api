"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cleanSkills = exports.levelForSkillXp = void 0;
const constants_1 = require("../../constants");
// the highest level you can have in each skill
// numbers taken from https://hypixel-skyblock.fandom.com/wiki/Skills
// maybe these should be moved to skyblock-constants?
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
// for skills that aren't in maxSkills, default to this
const skillsDefaultMaxLevel = 50;
/**
 * Get the skill level for the amount of total xp
 * @param xp The xp we're finding the level for
 * @param easierLevel Whether it should use the alternate leveling xp table (used for cosmetic skills and dungeoneering)
 */
async function levelForSkillXp(xp, maxLevel) {
    const xpTable = maxLevel <= 25 ? await constants_1.fetchSkillXpEasier() : await constants_1.fetchSkillXp();
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
            const xpTable = skillMaxLevel <= 25 ? await constants_1.fetchSkillXpEasier() : await constants_1.fetchSkillXp();
            // the level you're at for this skill
            const skillLevel = await levelForSkillXp(skillXp, skillMaxLevel);
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
