import * as constants from '../../constants'

export interface FairySouls {
	total: number
	/** The number of fairy souls that haven't been exchanged yet */
	unexchanged: number
	exchanges: number
	/** The highest possible number of total fairy souls */
	max: number
}

export async function cleanFairySouls(data: any): Promise<FairySouls> {
	const { max_fairy_souls } = await constants.fetchConstantValues()
	return {
		total: data?.fairy_souls_collected ?? 0,
		unexchanged: data?.fairy_souls ?? 0,
		exchanges: data?.fairy_exchanges ?? 0,
		max: max_fairy_souls ?? 0,
	}
}