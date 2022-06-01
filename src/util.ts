// Random utility functions that are not related to Hypixel


export function undashUuid(uuid: string): string {
	return uuid.replace(/-/g, '').toLowerCase()
}


export function jsonToQuery(data): string {
	return Object.entries(data || {}).map(e => e.join('=')).join('&')
}

export function shuffle<T>(a: T[]): T[] {
	for (let i = a.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1))
			;[a[i], a[j]] = [a[j], a[i]]
	}
	return a
}


export const minecraftColorCodes: { [key: string]: string } = {
	'0': '#000000',
	'1': '#0000be',
	'2': '#00be00',
	'3': '#00bebe',
	'4': '#be0000', // red
	'5': '#be00be',
	'6': '#ffaa00', // gold
	'7': '#bebebe',
	'8': '#3f3f3f',
	'9': '#3f3ffe',
	'a': '#3ffe3f',
	'b': '#3ffefe',
	'c': '#fe3f3f', // light red
	'd': '#fe3ffe',
	'e': '#fefe3f',
	'f': '#ffffff',

	'black': '#000000',
	'dark_blue': '#0000be',
	'dark_green': '#00be00',
	'dark_aqua': '#00bebe',
	'dark_red': '#be0000', // red
	'dark_purple': '#be00be',
	'gold': '#ffaa00', // gold
	'gray': '#bebebe',
	'dark_gray': '#3f3f3f',
	'blue': '#3f3ffe',
	'green': '#3ffe3f',
	'aqua': '#3ffefe',
	'red': '#fe3f3f', // light red
	'light_purple': '#fe3ffe',
	'yellow': '#fefe3f',
	'white': '#ffffff',
}

/**
 * Converts a color name to the code
 * For example: blue -> 9
 * @param colorName The name of the color (blue, red, aqua, etc)
 */
export function colorCodeFromName(colorName: string): string | null {
	const hexColor = minecraftColorCodes[colorName.toLowerCase()]
	for (const key in minecraftColorCodes) {
		const value = minecraftColorCodes[key]
		if (key.length === 1 && value === hexColor)
			return key
	}
	return null
}

export function letterFromColorCode(colorCode: string): string | null {
	for (const [key, value] of Object.entries(minecraftColorCodes)) {
		if (value === colorCode)
			return key
	}
	return null
}

export async function sleep(ms: number): Promise<void> {
	await new Promise(resolve => setTimeout(resolve, ms))
}

/** Returns whether a string is a UUID4 (Minecraft uuid) */
export function isUuid(string: string) {
	return undashUuid(string).length === 32
}

/**
 * Get a level for an amount of total xp
 * @param xp The xp we're finding the level for
 * @param xpTable The list of required xp values for each level, starting at 1
 */
export function levelFromXpTable(xp: number, xpTable: number[]) {
	const skillLevel = [...xpTable].reverse().findIndex(levelXp => xp >= levelXp)
	return skillLevel === -1 ? 0 : xpTable.length - skillLevel
}

// https://stackoverflow.com/a/51365037
export type RecursivePartial<T> = {
	[P in keyof T]?:
	T[P] extends (infer U)[] ? RecursivePartial<U>[] :
	T[P] extends object ? RecursivePartial<T[P]> :
	T[P]
}

let caches: Map<string, {
	data: any
	isFetching: boolean
	nextUpdate: Date
}> = new Map()

export async function withCache<T>(key: string, ttl: number | ((arg: T) => Date), task: () => Promise<T>): Promise<T> {
	if (caches.get(key)?.data && caches.get(key)!.nextUpdate > new Date())
		return caches.get(key)!.data

	// if it's currently fetching the election data and it doesn't have it,
	// wait until we do have the election data
	if (caches.get(key)?.isFetching && !caches.get(key)?.data) {
		await new Promise(resolve => {
			const interval = setInterval(() => {
				if (caches.get(key)?.data) {
					clearInterval(interval)
					resolve(caches.get(key)!.data)
				}
			}, 100)
		})
	}

	caches.set(key, {
		...(caches.get(key) ?? { data: undefined, nextUpdate: new Date(0) }),
		isFetching: true,
	})
	const data = await task().catch(e => {
		console.error(e)
		caches.set(key, {
			...(caches.get(key) ?? { data: undefined, nextUpdate: new Date(0) }),
			isFetching: false,
		})
		return undefined
	})
	caches.set(key, {
		...caches.get(key)!,
		isFetching: false,
	})
	if (!data) return undefined as any

	caches.set(key, {
		...caches.get(key)!,
		data
	})

	const nextUpdate = typeof ttl === 'number' ? new Date(Date.now() + ttl) : ttl(data)

	caches.set(key, {
		...caches.get(key)!,
		nextUpdate
	})
	return data
}
