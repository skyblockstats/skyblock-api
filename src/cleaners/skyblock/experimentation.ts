import typedHypixelApi from 'typed-hypixel-api'
import * as constants from '../../constants.js'

export interface ExperimentationGame {
	id: string
	last
	types: {
		attempts: number

	}[]
}

export interface Experimentation {
	games: ExperimentationGame[]
}

export async function cleanExperimentationTable(data: typedHypixelApi.SkyBlockProfileMember): Promise<Experimentation> {
	return {
		games: []
	}
}
