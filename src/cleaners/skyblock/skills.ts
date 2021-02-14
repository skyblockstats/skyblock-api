export interface Skill {
	name: string
	xp: number
}

export function cleanSkills(data: any): Skill[] {
	const skills: Skill[] = []
	for (const item in data) {
		if (item.startsWith('experience_skill_')) {
			const skillName = item.substr('experience_skill_'.length)
			const skillValue = data[item]
			skills.push({
				name: skillName,
				xp: skillValue
			})
		}
	}
	return skills
}
