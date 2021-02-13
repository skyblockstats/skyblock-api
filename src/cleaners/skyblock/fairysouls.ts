export interface FairySouls {
	total: number
	/** The number of fairy souls that haven't been exchanged yet */
	unexchanged: number
	exchanges: number
}

export function cleanFairySouls(data: any): FairySouls {
	return {
		total: data?.fairy_souls_collected ?? 0,
		unexchanged: data?.fairy_souls ?? 0,
		exchanges: data?.fairy_exchanges ?? 0,
	}
}