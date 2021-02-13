/**
 * Fetch the raw Hypixel API
 */
import fetch from 'node-fetch'
import { jsonToQuery, shuffle } from './util'
import { Agent } from 'https'
require('dotenv').config()

// We need to create an agent to prevent memory leaks and to only do dns lookups once
const httpsAgent = new Agent({
	keepAlive: true
})

/* Lower level code related to the Hypixel api */

const apiKeys = process.env.hypixel_keys.split(' ')

interface KeyUsage {
	remaining: number
	limit: number
	reset: number
}

const apiKeyUsage: { [ key: string ]: KeyUsage } = {}


const baseHypixelAPI = 'https://api.hypixel.net'

/** Choose the best current API key */
export function chooseApiKey(): string {
	// find the api key with the lowest amount of uses
	let bestKeyUsage: KeyUsage = null
	let bestKey: string = null
	for (var key of shuffle(apiKeys)) {
		const keyUsage = apiKeyUsage[key]

		// if the key has never been used before, use it
		if (!keyUsage) return key

		// if the key has reset since the last use, set the remaining count to the default
		if (Date.now() > keyUsage.reset)
			keyUsage.remaining = keyUsage.limit

		// if this key has more uses remaining than the current known best one, save it
		if (!bestKeyUsage || keyUsage.remaining > bestKeyUsage.remaining) {
			bestKeyUsage = keyUsage
			bestKey = key
		}
	}
	return bestKey
}

export interface HypixelResponse {
	[key: string]: any | {
        success: boolean
        throttled?: boolean
    }
}


export interface HypixelPlayerStatsSkyBlockProfiles {
	[ uuid: string ]: {
		profile_id: string
		cute_name: string
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
export async function sendApiRequest({ path, key, args }): Promise<HypixelResponse> {
	console.log('sending api request to', path, args)
	// Send a raw http request to api.hypixel.net, and return the parsed json

	if (key)
		// If there's an api key, add it to the arguments
		args.key = key

	// Construct a url from the base api url, path, and arguments
	const fetchUrl = baseHypixelAPI + '/' + path + '?' + jsonToQuery(args)

	const fetchResponse = await fetch(
		fetchUrl,
		{ agent: () => httpsAgent }
	)

	if (fetchResponse.headers['ratelimit-limit'])
		// remember how many uses it has
		apiKeyUsage[key] = {
			remaining: fetchResponse.headers['ratelimit-remaining'],
			limit: fetchResponse.headers['ratelimit-limit'],
			reset: Date.now() + parseInt(fetchResponse.headers['ratelimit-reset']) * 1000
		}
	
	const fetchJsonParsed = await fetchResponse.json()
	if (fetchJsonParsed.throttle) {
		apiKeyUsage[key].remaining = 0
		console.log('throttled :(')
		return { throttled: true }
	}
	return fetchJsonParsed
}

