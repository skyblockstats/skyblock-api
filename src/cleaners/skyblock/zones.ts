import typedHypixelApi from 'typed-hypixel-api'
import * as constants from '../../constants.js'

export interface Zone {
	name: string
	visited: boolean
}

export function zoneIdToName(id: string) {
	// this currently does nothing, but in the future it could get data from https://api.hypixel.net/resources/games
	return id
}


export async function cleanVisitedZones(data: typedHypixelApi.SkyBlockProfileMember): Promise<Zone[]> {
	const rawZones = data?.visited_zones || []

	constants.addZones(rawZones)

	const zones: Zone[] = []

	const knownZones = await constants.fetchZones()

	for (const rawZoneName of knownZones) {
		zones.push({
			name: zoneIdToName(rawZoneName),
			visited: rawZones.includes(rawZoneName)
		})
	}

	// if this user somehow has a zone that we don't know about, just add it to zones
	for (const rawZoneName of rawZones) {
		if (!knownZones.includes(rawZoneName)) {
			zones.push({
				name: rawZoneName,
				visited: true
			})
		}
	}

	return zones
}
