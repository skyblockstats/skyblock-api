import { cleanSkyblockProfileResponseLighter } from "./profile"

export interface Bank {
	balance: number
	history: any[]
}

export function cleanBank(data: any): Bank {
	return {
		balance: data?.banking?.balance ?? 0,
		// TODO: make transactions good
		history: data?.banking?.transactions ?? []
	}
}