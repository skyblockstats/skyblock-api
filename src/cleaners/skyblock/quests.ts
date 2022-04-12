import typedHypixelApi from 'typed-hypixel-api'

/*
Each quest has a number of attached objectives that must be completed in order for the quest to be counted as complete. Quests show when they started and when they ended. All attached objectives will be in between these times.

An objective has a number called the "progress". This usually represents how much of the objective item has been collected, so if the objective requires you to collect logs the progress would be the amount collected. If the objective doesn't require you to collect items, this will be 0.

What we want to know:
- The attached objectives for each quest
- The minimum required progress for each objective for be completed
*/

export interface Objective {
	id: string
	completed: boolean
	progress: {
		done: number
		required: number
	} | null
}

export interface Quest {
	id: string
	completed: boolean
	objectives: Objective
}

export function cleanQuests(data: typedHypixelApi.SkyBlockProfileMember): Quest[] {
	// objective: [ quests ]
	const possibleAttachedQuests: Record<string, string[]> = {}
	for (const [objectiveId, objectiveValue] of Object.entries(data.objectives)) {
		possibleAttachedQuests[objectiveId] = []
		// figure out what quests this objective could belong to
		if (objectiveValue.status === 'COMPLETE') {
			for (const [questId, questValue] of Object.entries(data.quests)) {
				if (questValue.status === 'COMPLETE') {
					if (
						objectiveValue.completed_at >= questValue.activated_at
						&& objectiveValue.completed_at <= questValue.completed_at
					) {
						// console.log('objective', objectiveId, 'could belong to quest', questId)
						possibleAttachedQuests[objectiveId].push(questId)
					}
				}
			}
		}
		if (objectiveValue.status === 'ACTIVE') {
			for (const [questId, questValue] of Object.entries(data.quests)) {
				if (questValue.status === 'ACTIVE') {
					console.log('active objective', objectiveId, 'could belong to quest', questId)
					possibleAttachedQuests[objectiveId].push(questId)
				}
			}
		}
	}

	console.log('possibleAttachedQuests', possibleAttachedQuests)


	return []
}
