import typedHypixelApi from 'typed-hypixel-api'

interface EssenceType {
	id: string
	amount: number
}

export interface Essence {
	types: EssenceType[]
}

export function cleanEssence(data: typedHypixelApi.SkyBlockProfileMember): Essence {
	const essences: EssenceType[] = []

	for (const [id, amount] of Object.entries(data ?? {})) {
		if (id.startsWith('essence_')) {
			essences.push({
				id: id.replace(/^essence_/, ''),
				amount: amount ?? 0,
			})
		}
	}

	return {
		types: essences,
	}
}