const candidateColors = [
	'4', 'a', '3', 'e', '5',
]

export interface MayorPerk {
	name: string
	description: string
}

export interface Candidate {
	name: string
	perks: MayorPerk[]
	votes: number
	color: string | null
}

export interface ElectionData {
	lastUpdated: number
	previous: {
		year: number
		winner: Candidate
		candidates: Candidate[]
	}
	current: {
		year: number
		candidates: Candidate[]
	} | null
}

function cleanCandidate(data: any, index: number): Candidate {
	return {
		name: data.name,
		perks: data.perks.map(perk => ({
			name: perk.name,
			description: '§7' + perk.description,
		})),
		votes: data.votes,
		color: candidateColors[index],
	}
}

export function cleanElectionResponse(data: any): ElectionData {
	const previousCandidates = data.mayor.election.candidates.map(cleanCandidate)
	return {
		lastUpdated: data.lastUpdated,
		previous: {
			year: data.mayor.election.year,
			winner: data.mayor.name,
			candidates: previousCandidates
		},
		current: data.current ? {
			year: data.current.year,
			candidates: data.current.candidates.map(cleanCandidate)
		} : null
	}
}