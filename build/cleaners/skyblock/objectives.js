export function cleanObjectives(data) {
    const rawObjectives = data?.objectives || {};
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
