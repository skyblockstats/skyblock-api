import typedHypixelApi from 'typed-hypixel-api'

export type GameMode = 'normal' | 'stranded' | 'bingo' | 'ironman'
const gameModeMap: Record<NonNullable<typedHypixelApi.SkyBlockProfile['game_mode']>, GameMode> = {
	bingo: 'bingo',
	island: 'stranded',
	ironman: 'ironman',
}

export function cleanGameMode(data: typedHypixelApi.SkyBlockProfile): GameMode {
	return (data.game_mode && (data.game_mode in gameModeMap)) ? gameModeMap[data.game_mode] : 'normal'
}
