import typedHypixelApi from 'typed-hypixel-api'
import { fetchHarpSongs } from '../../constants.js'

export interface HarpSong {
	id: string
	/** A number between 0 and 1 representing the user's best completion */
	progress: number
	completions: number
	perfectCompletions: number
}

export interface HarpData {
	selected: {
		id: string
		timestamp: number
	} | null
	claimedMelodysHair: boolean
	songs: HarpSong[]
}

export async function cleanHarp(data: typedHypixelApi.SkyBlockProfileMember): Promise<HarpData> {
	const harpQuestData = data.harp_quest ?? {}
	const songs: HarpSong[] = []

	const allHarpSongNames = await fetchHarpSongs()

	for (const item in data.harp_quest) {
		if (item.startsWith('song_') && item.endsWith('_best_completion')) {
			const songName = item.slice('song_'.length, -'_best_completion'.length)
			songs.push({
				id: songName,
				completions: data.harp_quest[`song_${songName}_completions`],
				perfectCompletions: data.harp_quest[`song_${songName}_perfect_completions`],
				progress: data.harp_quest[`song_${songName}_best_completion`]
			})
		}
	}

	const missingHarpSongNames = allHarpSongNames.filter(songName => !songs.find(song => song.id === songName))
	for (const songName of missingHarpSongNames) {
		songs.push({
			id: songName,
			completions: 0,
			perfectCompletions: 0,
			progress: 0
		})
	}


	return {
		selected: harpQuestData?.selected_song ? {
			id: harpQuestData.selected_song,
			// i'm pretty sure the epoch is always there if the name is
			timestamp: harpQuestData.selected_song_epoch ?? 0
		} : null,
		claimedMelodysHair: harpQuestData?.claimed_talisman ?? false,
		songs
	}
}