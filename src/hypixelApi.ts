/**
 * Fetch the raw Hypixel API
 */
import { jsonToQuery, shuffle, sleep } from './util.js'
import * as nodeFetch from 'node-fetch'
import fetch from 'node-fetch'
import { Agent } from 'https'

if (!process.env.hypixel_keys)
	// if there's no hypixel keys in env, run dotenv
	(await import('dotenv')).config()

// We need to create an agent to prevent memory leaks and to only do dns lookups once
const httpsAgent = new Agent({
	keepAlive: true
})


/** This array should only ever contain one item because using multiple hypixel api keys isn't allowed :) */ 
const apiKeys = process.env?.hypixel_keys?.split(' ') ?? []

interface KeyUsage {
	remaining: number
	limit: number
	reset: number
}

const apiKeyUsage: { [ key: string ]: KeyUsage } = {}
// the usage amount the api key was on right before it reset
const apiKeyMaxUsage: { [ key: string ]: number } = {}

const baseHypixelAPI = 'https://api.hypixel.net'


/** Choose the best current API key */
export function chooseApiKey(): string | null {
	// find the api key with the lowest amount of uses
	let bestKeyUsage: KeyUsage | null = null
	let bestKey: string | null = null
	// we limit to 5 api keys because otherwise they get automatically banned
	for (let key of shuffle(apiKeys.slice(0, 5))) {
		const keyUsage = apiKeyUsage[key]

		// if the key has never been used before, use it
		if (!keyUsage) return key

		// if the key has reset since the last use, set the remaining count to the default
		if (Date.now() > keyUsage.reset) {
			apiKeyMaxUsage[key] = keyUsage.limit - keyUsage.remaining
			keyUsage.remaining = keyUsage.limit
		}

		// if this key has more uses remaining than the current known best one, save it
		if (bestKeyUsage === null || keyUsage.remaining > bestKeyUsage.remaining) {
			bestKeyUsage = keyUsage
			bestKey = key
		}
	}
	return bestKey
}

export function getKeyUsage() {
	let keyLimit = 0
	let keyUsage = 0
	for (let key of Object.keys(apiKeyMaxUsage)) {
		// if the key isn't in apiKeyUsage, continue
		if (!apiKeyUsage[key]) continue

		keyUsage += apiKeyMaxUsage[key]
		keyLimit += apiKeyUsage[key].limit
	}
	return {
		limit: keyLimit,
		usage: keyUsage
	}
}

export interface HypixelResponse {
	[key: string]: any | {
        success: boolean
        throttled?: boolean
    }
}


export interface HypixelPlayerStatsSkyBlockProfiles {
	[ uuid: string ]: {
		profileId: string
		cuteName: string
	}
}

interface HypixelPlayerStatsSkyBlock {
	profiles: HypixelPlayerStatsSkyBlockProfiles
}

export interface HypixelPlayerSocialMedia {
	YOUTUBE?: string
	prompt: boolean
	links: {
		DISCORD?: string
		HYPIXEL?: string
	}
}

export interface HypixelPlayer {
	_id: string
	achievementsOneTime: string[]
	displayname: string

	firstLogin: number,
	lastLogin: number,
	lastLogout: number

	knownAliases: string[],
	knownAliasesLower: string[]

	networkExp: number
	playername: string
	stats: {
		SkyBlock: HypixelPlayerStatsSkyBlock
		[ name: string ]: any
	},
	timePlaying: number,
	uuid: string,
	achievements: { [ name: string ]: number },
	petConsumables: { [ name: string ]: number },
	vanityMeta: {
		packages: string[]
	},

	language: string,
	userLanguage?: string

	packageRank?: string
	newPackageRank?: string
	rankPlusColor?: string
	monthlyPackageRank?: string
	rank?: string
	prefix?: string

	claimed_potato_talisman?: number
	skyblock_free_cookie?: number

	socialMedia?: HypixelPlayerSocialMedia
}

/** Send an HTTP request to the Hypixel API */
export let sendApiRequest = async function sendApiRequest({ path, key, args }): Promise<HypixelResponse> {
	// Send a raw http request to api.hypixel.net, and return the parsed json

	if (key)
		// If there's an api key, add it to the arguments
		args.key = key

	// Construct a url from the base api url, path, and arguments
	const fetchUrl = baseHypixelAPI + '/' + path + '?' + jsonToQuery(args)

	let fetchResponse: nodeFetch.Response
	let fetchJsonParsed: any

	try {
		fetchResponse = await fetch(
			fetchUrl,
			{ agent: () => httpsAgent }
		)
		fetchJsonParsed = await fetchResponse.json()
	} catch {
		// if there's an error, wait a second and try again
		await sleep(1000)
		return await sendApiRequest({ path, key, args })
	}

	// bruh
	if (fetchJsonParsed.cause === 'This endpoint is currently disabled') {
		await sleep(30000)
		return await sendApiRequest({ path, key, args })
	}

	// if the cause is "Invalid API key", remove the key from the list of keys and try again
	if (fetchJsonParsed.cause === 'Invalid API key') {
		if (apiKeys.includes(key)) {
			apiKeys.splice(apiKeys.indexOf(key), 1)
			console.log(`${key} is invalid, removing it from the list of keys`)
		}
		return await sendApiRequest({ path, key: chooseApiKey(), args })
	}

	if (fetchResponse.headers.get('ratelimit-limit')) {
		// remember how many uses it has
		apiKeyUsage[key] = {
			remaining: parseInt(fetchResponse.headers.get('ratelimit-remaining') ?? '0'),
			limit: parseInt(fetchResponse.headers.get('ratelimit-limit') ?? '0'),
			reset: Date.now() + parseInt(fetchResponse.headers.get('ratelimit-reset') ?? '0') * 1000 + 1000,
		}

		let usage = apiKeyUsage[key].limit - apiKeyUsage[key].remaining
		// if it's not in apiKeyMaxUsage or this usage is higher, update it
		if (!apiKeyMaxUsage[key] || (usage > apiKeyMaxUsage[key]))
			apiKeyMaxUsage[key] = usage
	}
	
	if (fetchJsonParsed.throttle) {
		if (apiKeyUsage[key])
			apiKeyUsage[key].remaining = 0
		// if it's throttled, wait 10 seconds and try again
		await sleep(10000)
		return await sendApiRequest({ path, key, args })
	}
	return fetchJsonParsed
}

// this is necessary for mocking in the tests because es6
export function mockSendApiRequest($value) { sendApiRequest = $value }