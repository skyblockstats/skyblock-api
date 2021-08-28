/**
 * Fetch the raw Hypixel API
 */
import { jsonToQuery, shuffle } from './util'
import type { Response } from 'node-fetch'
import fetch from 'node-fetch'
import { Agent } from 'https'
import { debug } from '.'

if (!process.env.hypixel_keys)
	// if there's no hypixel keys in env, run dotenv
	require('dotenv').config()

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


const baseHypixelAPI = 'https://api.hypixel.net'


/** Choose the best current API key */
export function chooseApiKey(): string | null {
	// find the api key with the lowest amount of uses
	let bestKeyUsage: KeyUsage | null = null
	let bestKey: string | null = null
	for (let key of shuffle(apiKeys.slice())) {
		const keyUsage = apiKeyUsage[key]

		// if the key has never been used before, use it
		if (!keyUsage) return key

		// if the key has reset since the last use, set the remaining count to the default
		if (Date.now() > keyUsage.reset)
			keyUsage.remaining = keyUsage.limit

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
	for (let key of Object.values(apiKeyUsage)) {
		keyLimit += key.limit
		keyUsage += key.limit - key.remaining
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
	// Send a raw http request to api.hypixel.net, and return the parsed json
	let headers: HeadersInit = {}
	if (
		key
		// keys arent required for skyblock/auctions
		&& path !== 'skyblock/auctions'
	)
		// If there's an api key, add it to the arguments
		headers['API-Key'] = key

	// Construct a url from the base api url, path, and arguments
	const fetchUrl = baseHypixelAPI + '/' + path + '?' + jsonToQuery(args)

	let fetchResponse: Response
	let fetchJsonParsed: any

	// the number of times it's retried the attempt
	let retries = 0

	const maxRetries = 2

	while (retries <= maxRetries) {
		try {
			fetchResponse = await fetch(
				fetchUrl,
				{
					agent: () => httpsAgent,
					headers
				}
			)
			fetchJsonParsed = await fetchResponse.json()
			break
		} catch (err) {
			console.warn(err)
			retries ++

			// too many retries, just throw the error
			if (retries > maxRetries)
				throw err
		}
	}

	// bruh
	if (fetchJsonParsed.cause === 'This endpoint is currently disabled') {
		await new Promise((resolve) => setTimeout(resolve, 30000))
		return await sendApiRequest({ path, key, args })
	}

	if (fetchResponse!.headers.get('ratelimit-limit'))
		// remember how many uses it has
		apiKeyUsage[key] = {
			remaining: parseInt(fetchResponse!.headers.get('ratelimit-remaining') ?? '0'),
			limit: parseInt(fetchResponse!.headers.get('ratelimit-limit') ?? '0'),
			reset: Date.now() + parseInt(fetchResponse!.headers.get('ratelimit-reset') ?? '0') * 1000
		}
	
	if (fetchJsonParsed.throttle) {
		if (apiKeyUsage[key])
			apiKeyUsage[key].remaining = 0
		// if it's throttled, wait 10 seconds and try again
		await new Promise((resolve) => setTimeout(resolve, 10000))
		return await sendApiRequest({ path, key, args })
	}
	return fetchJsonParsed
}

