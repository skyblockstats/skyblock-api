import { fetchSkillXp, fetchSkillXpEasier } from '../../constants'

export interface Skill {
	name: string
	xp: number
	level: number

	maxLevel: number

	levelXp: number
	levelXpRequired: number
}

// the highest level you can have in each skill
// numbers taken from https://hypixel-skyblock.fandom.com/wiki/Skills
// maybe these should be moved to skyblock-constants?
const skillsMaxLevel: { [ key: string ]: number } = {
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
}

// for skills that aren't in maxSkills, default to this
const skillsDefaultMaxLevel: number = 50

/**
 * Get the skill level for the amount of total xp
 * @param xp The xp we're finding the level for
 * @param easierLevel Whether it should use the alternate leveling xp table (used for cosmetic skills and dungeoneering)
 */
export async function levelForSkillXp(xp: number, maxLevel: number) {
	const xpTable = maxLevel <= 25 ? await fetchSkillXpEasier() : await fetchSkillXp()
	const skillLevel = [...xpTable].reverse().findIndex(levelXp => xp >= levelXp)
	return skillLevel === -1 ? 0 : xpTable.length - skillLevel
}

export async function cleanSkills(data: any): Promise<Skill[]> {
	const skills: Skill[] = []
	for (const item in data) {
		if (item.startsWith('experience_skill_')) {
			const skillName = item.substr('experience_skill_'.length)

			// the amount of total xp you have in this skill
			const skillXp = data[item]

			const skillMaxLevel = skillsMaxLevel[skillName] ?? skillsDefaultMaxLevel

			const xpTable = skillMaxLevel <= 25 ? await fetchSkillXpEasier() : await fetchSkillXp()

			// the level you're at for this skill
			const skillLevel = await levelForSkillXp(skillXp, skillMaxLevel)

			// the total xp required for the previous level
			const previousLevelXp = skillLevel >= 1 ? xpTable[skillLevel - 1] : 0

			// the extra xp left over
			const skillLevelXp = skillXp - previousLevelXp

			// the amount of extra xp required for this level
			const skillLevelXpRequired = xpTable[skillLevel] - previousLevelXp

			skills.push({
				name: skillName,
				xp: skillXp,
				level: skillLevel,
				maxLevel: skillMaxLevel,
				levelXp: skillLevelXp,
				levelXpRequired: skillLevelXpRequired
			})
		}
	}
	return skills
}
