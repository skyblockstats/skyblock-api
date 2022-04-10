import typedHypixelApi from 'typed-hypixel-api'


export interface Objective {
	name: string
	completed: boolean
}

export function cleanObjectives(data: typedHypixelApi.SkyBlockProfileMember): Objective[] {
	const rawObjectives = data?.objectives || {}
	const objectives: Objective[] = []
	for (const [name, value] of Object.entries(rawObjectives)) {

		objectives.push({
			name: name,
			completed: value.status === 'COMPLETE',
		})
	}
	return objectives
}
