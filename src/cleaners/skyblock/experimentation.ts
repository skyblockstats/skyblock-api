import typedHypixelApi from 'typed-hypixel-api'
import { ExperimentationGame as ApiExperimentationGame } from 'typed-hypixel-api/build/responses/skyblock/_profile_member'
import * as constants from '../../constants.js'

export interface ExperimentationGame {
	/** `superpairs`, `chronomatron` or `ultrasequencer`.  */
	id: string
	last_attempt: number | undefined
	last_claimed: number | undefined
	types: {
		attempts: number
		claims: number
		best_score: number
	}[]
}

const EXPERIMENTATION_GAME_IDS = {
	pairings: 'superpairs',
	simon: 'chronomatron',
	numbers: 'ultrasequencer'
} as const

// this should be in skyblock-constants, but i don't expect hypixel to add new experimentation games
const EXPERIMENTATION_GAME_TYPES_COUNT: Record<typeof EXPERIMENTATION_GAME_IDS[keyof typeof EXPERIMENTATION_GAME_IDS], number> = {
	superpairs: 6,
	chronomatron: 5,
	ultrasequencer: 3
}

export interface Experimentation {
	games: ExperimentationGame[]
}

function cleanGame(apiId: string, game: ApiExperimentationGame | undefined): ExperimentationGame {
	const gameId = EXPERIMENTATION_GAME_IDS[apiId]

	if (!game)
		game = {}

	const types: ExperimentationGame['types'] = []

	for (let i = 0; i < EXPERIMENTATION_GAME_TYPES_COUNT[gameId]; i++) {
		const type_attempts = game[`attempts_${i}`] ?? 0
		const type_claims = game[`claims_${i}`] ?? 0
		const type_best_score = game[`best_score_${i}`] ?? 0

		types.push({
			attempts: type_attempts,
			claims: type_claims,
			best_score: type_best_score
		})
	}

	return {
		id: gameId,
		last_attempt: game.last_attempt || undefined,
		last_claimed: game.last_claimed || undefined,
		types
	}
}

export async function cleanExperimentation(data: typedHypixelApi.SkyBlockProfileMember): Promise<Experimentation> {
	return {
		games: [
			cleanGame('pairings', data.experimentation?.pairings),
			cleanGame('simon', data.experimentation?.simon),
			cleanGame('numbers', data.experimentation?.numbers)
		]
	}
}
