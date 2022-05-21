import typedHypixelApi from 'typed-hypixel-api'
import * as constants from '../../constants.js'

interface EssenceType {
	id: string
	value: number
}

export interface Essence {
	types: EssenceType[]
}

export function cleanEssence(data: typedHypixelApi.SkyBlockProfileMember): Essence {
	const essences: EssenceType[] = []

	for (const [id, value] of Object.entries(data ?? {})) {
		if (id.startsWith('essence_')) {
			essences.push({
				id: id.replace(/^essence_/, ''),
				value: value ?? 0,
			})
		}
	}

	return {
		types: essences,
	}
}