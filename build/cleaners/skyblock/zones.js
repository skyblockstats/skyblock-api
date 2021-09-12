import * as constants from '../../constants.js';
export async function cleanVisitedZones(data) {
    const rawZones = data?.visited_zones || [];
    // TODO: store all the zones that exist in SkyBlock, add add those to the array with visited being false
    const zones = [];
    const knownZones = await constants.fetchZones();
    for (const rawZoneName of knownZones) {
        zones.push({
            name: rawZoneName,
            visited: rawZones.includes(rawZoneName)
        });
    }
    // if this user somehow has a zone that we don't know about, just add it to zones
    for (const rawZoneName of rawZones) {
        if (!knownZones.includes(rawZoneName)) {
            zones.push({
                name: rawZoneName,
                visited: true
            });
        }
    }
    return zones;
}
