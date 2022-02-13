
const candidateColors = {
	barry: 'e',
	paul: '4',
	aatrox: 'a',
	foxy: '3',
	cole: 'e',
	marina: '5',
	diaz: '5',
	diana: '3',
}

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
	last_updated: number
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

function cleanCandidate(data: any): Candidate {
	return {
		name: data.name,
		perks: data.perks,
		votes: data.votes,
		color: candidateColors[data.name.toLowerCase()],
	}
}

export function cleanElectionResponse(data: any): ElectionData {
	return {
		last_updated: data.lastUpdated / 1000,
		previous: {
			year: data.mayor.election.year,
			winner: cleanCandidate({
				name: data.mayor.name,
				perks: data.mayor.perks,
				votes: data.mayor.election.candidates.find(c => c.key === data.mayor.key).votes,
			}),
			candidates: data.mayor.election.candidates.map(cleanCandidate)
		},
		current: data.current ? {
			year: data.current.year,
			candidates: data.current.candidates.map(cleanCandidate)
		} : null
	}
}