export interface Objective {
	name: string
	completed: boolean
}

export function cleanObjectives(data: any): Objective[] {
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
