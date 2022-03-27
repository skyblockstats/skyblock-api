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

const renamedSongs = {
	fire_and_flames: 'through_the_campfire'
}

export async function cleanHarp(data: typedHypixelApi.SkyBlockProfileMember): Promise<HarpData> {
	const harpQuestData = data.harp_quest ?? {}
	const songs: HarpSong[] = []

	const allHarpSongNames = await fetchHarpSongs()

	for (const item in data.harp_quest) {
		if (item.startsWith('song_') && item.endsWith('_best_completion')) {
			const apiSongName = item.slice('song_'.length, -'_best_completion'.length)
			const songName = renamedSongs[apiSongName] ?? apiSongName
			songs.push({
				id: songName,
				completions: data.harp_quest[`song_${apiSongName}_completions`] ?? 0,
				perfectCompletions: data.harp_quest[`song_${apiSongName}_perfect_completions`] ?? 0,
				progress: data.harp_quest[`song_${apiSongName}_best_completion`] ?? 0
			})
		}
	}

	const missingHarpSongNames = allHarpSongNames.filter(songName => !songs.find(song => (renamedSongs[song.id] ?? song.id) === songName))
	for (const songName of missingHarpSongNames) {
		songs.push({
			id: renamedSongs[songName] ?? songName,
			completions: 0,
			perfectCompletions: 0,
			progress: 0
		})
	}

	const selectedSongId = harpQuestData.selected_song ? renamedSongs[harpQuestData.selected_song] ?? harpQuestData.selected_song : null

	return {
		selected: selectedSongId ? {
			id: selectedSongId,
			// i'm pretty sure the epoch is always there if the name is
			timestamp: harpQuestData.selected_song_epoch ?? 0
		} : null,
		claimedMelodysHair: harpQuestData?.claimed_talisman ?? false,
		songs
	}
}