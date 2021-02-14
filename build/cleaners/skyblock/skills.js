"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cleanSkills = void 0;
function cleanSkills(data) {
    const skills = [];
    for (const item in data) {
        if (item.startsWith('experience_skill_')) {
            const skillName = item.substr('experience_skill_'.length);
            const skillValue = data[item];
            skills.push({
                name: skillName,
                xp: skillValue
            });
        }
    }
    return skills;
}
exports.cleanSkills = cleanSkills;
