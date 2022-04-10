import typedHypixelApi from 'typed-hypixel-api'
import { fetchItemList } from '../../hypixel.js'
import { levelFromXpTable } from '../../util.js'
import { fetchPets } from '../../constants.js'
import { ItemListItem } from './itemList.js'

export type GameMode = 'normal' | 'stranded' | 'bingo' | 'ironman'
const gameModeMap: Record<NonNullable<typedHypixelApi.SkyBlockProfile['game_mode']>, GameMode> = {
	bingo: 'bingo',
	island: 'stranded',
	ironman: 'ironman',
}

export function cleanGameMode(data: typedHypixelApi.SkyBlockProfile): GameMode {
	return (data.game_mode && (data.game_mode in gameModeMap)) ? gameModeMap[data.game_mode] : 'normal'
}
