"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cleanVisitedZones = void 0;
function cleanVisitedZones(data) {
    const rawZones = (data === null || data === void 0 ? void 0 : data.visited_zones) || [];
    // TODO: store all the zones that exist in SkyBlock, add add those to the array with visited being false
    const zones = [];
    for (const rawZoneName of rawZones) {
        zones.push({
            name: rawZoneName,
            visited: true
        });
    }
    return zones;
}
exports.cleanVisitedZones = cleanVisitedZones;
