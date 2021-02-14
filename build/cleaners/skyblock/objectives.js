"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cleanObjectives = void 0;
function cleanObjectives(data) {
    const rawObjectives = (data === null || data === void 0 ? void 0 : data.objectives) || {};
    const objectives = [];
    for (const rawObjectiveName in rawObjectives) {
        const rawObjectiveValue = rawObjectives[rawObjectiveName];
        objectives.push({
            name: rawObjectiveName,
            completed: rawObjectiveValue.status === 'COMPLETE',
        });
    }
    return objectives;
}
exports.cleanObjectives = cleanObjectives;
