import typedHypixelApi from 'typed-hypixel-api'
import { fetchSkills } from '../../constants.js'
import { levelFromXpTable } from '../../util.js'
import * as constants from '../../constants.js'
import { CleanFullPlayer } from '../player.js'

export interface Skill {
	id: string
	xp: number
	level: number

	maxLevel: number

	levelXp: number
	levelXpRequired: number
}

export interface Skills {
	list: Skill[]
	/**
	 * Whether the player has their skills API enabled. If this is off, that
	 * means the data doesn't include xp and is per-player. You should show a
	 * warning to the user.
	 */
	apiEnabled: boolean
}

// the highest level you can have in each skill
// numbers taken from https://hypixel-skyblock.fandom.com/wiki/Skills
const skillsMaxLevel: { [key: string]: number } = {
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

const skillXpTable = [
	50, // 1
	175,
	375,
	675,
	1175,
	1925,
	2925,
	4425,
	6425,
	9925, // 10
	14925,
	22425,
	32425,
	47425,
	67425,
	97425,
	147425,
	222425,
	322425,
	522425, // 20
	822425,
	1222425,
	1722425,
	2322425,
	3022425,
	3822425,
	4722425,
	5722425,
	6822425,
	8022425, // 30
	9322425,
	10722425,
	12222425,
	13822425,
	15522425,
	17322425,
	19222425,
	21222425,
	23322425,
	25522425, // 40
	27822425,
	30222425,
	32722425,
	35322425,
	38072425,
	40972425,
	44072425,
	47472425,
	51172425,
	55172425, // 50
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
]


const skillXpTableEasier = [
	50,  // 1
	150,
	275,
	435,
	635,
	885,
	1200,
	1600,
	2100,
	2725, // 10
	3510,
	4510,
	5760,
	7325,
	9325,
	11825,
	14950,
	18950,
	23950,
	30200, // 20
	38050,
	47850,
	60100,
	75400,
	94450 // 25
]


// for skills that aren't in maxSkills, default to this
const skillsDefaultMaxLevel: number = 50

/**
 * Get the skill level for the amount of total xp
 * @param xp The xp we're finding the level for
 * @param easierLevel Whether it should use the alternate leveling xp table (used for cosmetic skills and dungeoneering)
 */
export function levelForSkillXp(xp: number, maxLevel: number) {
	const xpTable = (maxLevel <= 25 ? skillXpTableEasier : skillXpTable).slice(0, maxLevel)
	return levelFromXpTable(xp, xpTable)
}

function skillFromLevel(id: string, level: number | undefined): Skill {
	if (level === undefined)
		level = 0
	const maxLevel = skillsMaxLevel[id] ?? skillsDefaultMaxLevel
	const xpTable = (maxLevel <= 25 ? skillXpTableEasier : skillXpTable).slice(0, maxLevel)
	const xp = level > 0 ? xpTable[level - 1] ?? 0 : 0

	return {
		id,
		level,
		levelXp: 0,
		levelXpRequired: xpTable[level],
		maxLevel: maxLevel,
		xp
	}
}

function skillsFromSkyBlockAchievements(achievements: CleanFullPlayer['achievements']): Skills {
	return {
		apiEnabled: false,
		list: [
			skillFromLevel('fishing', achievements.tiered.find(a => a.id === 'angler')?.amount ?? 0),
			skillFromLevel('enchanting', achievements.tiered.find(a => a.id === 'augmentation')?.amount ?? 0),
			skillFromLevel('combat', achievements.tiered.find(a => a.id === 'combat')?.amount ?? 0),
			skillFromLevel('alchemy', achievements.tiered.find(a => a.id === 'concoctor')?.amount ?? 0),
			skillFromLevel('taming', achievements.tiered.find(a => a.id === 'domesticator')?.amount ?? 0),
			skillFromLevel('dungeoneering', achievements.tiered.find(a => a.id === 'dungeoneer')?.amount ?? 0),
			skillFromLevel('mining', achievements.tiered.find(a => a.id === 'excavator')?.amount ?? 0),
			skillFromLevel('foraging', achievements.tiered.find(a => a.id === 'gatherer')?.amount ?? 0),
			skillFromLevel('farming', achievements.tiered.find(a => a.id === 'harvester')?.amount ?? 0)
		]
	}
}

export async function cleanSkills(data: typedHypixelApi.SkyBlockProfileMember, player: CleanFullPlayer): Promise<Skills> {
	const allSkillNames = await fetchSkills()
	const skills: Skill[] = []

	let skillNamesFound: string[] = []

	for (const item in data) {
		if (item.startsWith('experience_skill_')) {
			const skillName = item.slice('experience_skill_'.length)
			skillNamesFound.push(skillName)

			// the amount of total xp you have in this skill
			const skillXp: number = data[item]

			const skillMaxLevel = skillsMaxLevel[skillName] ?? skillsDefaultMaxLevel

			const xpTable = (skillMaxLevel <= 25 ? skillXpTableEasier : skillXpTable).slice(0, skillMaxLevel)

			// the level you're at for this skill
			const skillLevel = levelForSkillXp(skillXp, skillMaxLevel)

			// the total xp required for the previous level
			const previousLevelXp = skillLevel >= 1 ? xpTable[skillLevel - 1] : 0

			// the extra xp left over
			const skillLevelXp = skillXp - previousLevelXp

			// the amount of extra xp required for this level
			const skillLevelXpRequired = xpTable[skillLevel] - previousLevelXp

			skills.push({
				id: skillName,
				xp: skillXp,
				level: skillLevel,
				maxLevel: skillMaxLevel,
				levelXp: skillLevelXp,
				levelXpRequired: skillLevelXpRequired
			})
		}
	}

	// if the player has no skills but has kills, we can assume they have the skills api off
	// (we check kills to know whether the profile is actually used, this is kinda arbitrary)
	if (skills.length === 0 && 'stats' in data && Object.keys(data.stats).includes('kills')) {
		return skillsFromSkyBlockAchievements(player.achievements)
	}

	constants.addSkills(skillNamesFound)


	// add missing skills
	const missingSkillNames = allSkillNames.filter(skillName => !skills.some(skill => skill.id === skillName))
	for (const skillName of missingSkillNames) {
		const skillMaxLevel = skillsMaxLevel[skillName] ?? skillsDefaultMaxLevel
		const xpTable = (skillMaxLevel <= 25 ? skillXpTableEasier : skillXpTable).slice(0, skillMaxLevel)
		skills.push({
			id: skillName,
			xp: 0,
			level: 0,
			maxLevel: skillMaxLevel,
			levelXp: 0,
			levelXpRequired: xpTable[0]
		})
	}

	// sort skills by name
	skills.sort((a, b) => a.id.localeCompare(b.id))

	return {
		apiEnabled: true,
		list: skills,
	}
}
