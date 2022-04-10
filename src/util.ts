/**
 * Random utility functions that are not related to Hypixel
 */

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
export function colorCodeFromName(colorName: string): string | undefined {
	const hexColor = minecraftColorCodes[colorName.toLowerCase()]
	for (const key in minecraftColorCodes) {
		const value = minecraftColorCodes[key]
		if (key.length === 1 && value === hexColor)
			return key
	}
}

export function letterFromColorCode(colorCode: string): string | undefined {
	for (const [key, value] of Object.entries(minecraftColorCodes)) {
		if (value === colorCode)
			return key
	}
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
