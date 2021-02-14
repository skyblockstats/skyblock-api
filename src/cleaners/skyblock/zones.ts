export interface Zone {
	name: string
	visited: boolean
}


export function cleanVisitedZones(data: any): Zone[] {
	const rawZones = data?.visited_zones || []
	// TODO: store all the zones that exist in SkyBlock, add add those to the array with visited being false
	const zones: Zone[] = []
	for (const rawZoneName of rawZones) {
		zones.push({
			name: rawZoneName,
			visited: true
		})
	}
	return zones
}
