import typedHypixelApi from 'typed-hypixel-api'


export interface Objective {
	name: string
	completed: boolean
}

export function cleanObjectives(data: typedHypixelApi.SkyBlockProfileMember): Objective[] {
	const rawObjectives = data?.objectives || {}
	const objectives: Objective[] = []
	for (const rawObjectiveName in rawObjectives) {
		const rawObjectiveValue = rawObjectives[rawObjectiveName]
		objectives.push({
			name: rawObjectiveName,
			completed: rawObjectiveValue.status === 'COMPLETE',
		})
	}
	return objectives
}
