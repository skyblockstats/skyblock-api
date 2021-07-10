import { diff as fastMyersDiff } from 'fast-myers-diff'


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


export const minecraftColorCodes: { [ key: string ]: string } = {
	'0': '#000000', // black
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
	'f': '#ffffff', // white

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

export async function sleep(ms: number): Promise<void> {
	await new Promise(resolve => setTimeout(resolve, ms))
}

/** Returns whether a string is a UUID4 (Minecraft uuid) */
export function isUuid(string: string) {
	return undashUuid(string).length === 32
}

export function replaceDifferencesWithQuestionMark(string1: string, string2: string): string {
	const string1split = string1.replace(/(§.|[^\w? ])/gi, ' $1 ').split(' ')
	const string2split = string2.replace(/(§.|[^\w? ])/gi, ' $1 ').split(' ')

	let result = string1split.slice() // this will be modified, and we slice to clone it
	let resultOffset = 0

	const patch = fastMyersDiff(string1split, string2split)

	for (const [removeStart, removeEnd, insertStart, insertEnd] of patch) {
		const replace = string1split.slice(removeStart, removeEnd).join(' ').replace(/ (§.|[^\w? ]) /gi, '$1')
		const replaceWith = string2split.slice(insertStart, insertEnd).join(' ').replace(/ (§.|[^\w? ]) /gi, '$1')


		result.splice(
			resultOffset + removeStart,
			removeEnd - removeStart,
			...(Math.min(replace.length, replaceWith.length) > 0 ? ['?'.repeat(Math.min(replace.length, replaceWith.length))] : [])
		)

		resultOffset += (Math.min(replace.length, replaceWith.length) > 0 ? 1 : 0) - (removeEnd-removeStart)
	}
	return result.join(' ').replace(/ (§.|[^\w? ]) /gi, '$1')
}
