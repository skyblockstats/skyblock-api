/**
 * Fetch the raw Hypixel API
 */
import { shuffle, sleep } from './util.js'
import typedHypixelApi from 'typed-hypixel-api'

if (!process.env.hypixel_keys)
	// if there's no hypixel keys in env, run dotenv
	(await import('dotenv')).config()


/** This array should only ever contain one item because using multiple hypixel api keys isn't allowed :) */
const apiKeys = process.env?.hypixel_keys?.split(' ') ?? []

if (apiKeys.length === 0) {
	console.warn('Warning: hypixel_keys was not found in .env. This will prevent the program from using the Hypixel API.')
}

interface KeyUsage {
	remaining: number
	limit: number
	reset: number
}

const apiKeyUsage: { [key: string]: KeyUsage } = {}
// the usage amount the api key was on right before it reset
const apiKeyMaxUsage: { [key: string]: number } = {}


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
	[uuid: string]: {
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



/** Send an HTTP request to the Hypixel API */
export let sendApiRequest = async<P extends keyof typedHypixelApi.Requests>(path: P, options: typedHypixelApi.Requests[P]['options']): Promise<typedHypixelApi.Requests[P]['response']['data']> => {
	// Send a raw http request to api.hypixel.net, and return the parsed json
	let response: typedHypixelApi.Requests[P]['response']
	try {
		response = await typedHypixelApi.request(
			path,
			options
		)
	} catch (e) {
		await sleep(1000)
		return await sendApiRequest(path, options)
	}

	if (!response.data.success) {
		// bruh
		if (response.data.cause === 'This endpoint is currently disabled') {
			await sleep(30000)
			return await sendApiRequest(path, options)
		}

		// if the cause is "Invalid API key", remove the key from the list of keys and try again
		if ('key' in options && response.data.cause === 'Invalid API key') {
			if (apiKeys.includes(options.key)) {
				apiKeys.splice(apiKeys.indexOf(options.key), 1)
				console.log(`${options.key} is invalid, removing it from the list of keys`)
			}
			return await sendApiRequest(path, {
				...options,
				key: chooseApiKey()
			})
		}
	}

	if ('key' in options && response.headers['ratelimit-limit']) {
		// remember how many uses it has
		apiKeyUsage[options.key] = {
			remaining: response.headers['ratelimit-remaining'] ?? 0,
			limit: response.headers['ratelimit-limit'] ?? 0,
			reset: Date.now() + response.headers['ratelimit-reset'] ?? 0 * 1000 + 1000,
		}

		let usage = apiKeyUsage[options.key].limit - apiKeyUsage[options.key].remaining
		// if it's not in apiKeyMaxUsage or this usage is higher, update it
		if (!apiKeyMaxUsage[options.key] || (usage > apiKeyMaxUsage[options.key]))
			apiKeyMaxUsage[options.key] = usage
	}

	if ('key' in options && !response.data.success && 'throttle' in response.data && response.data.throttle) {
		if (apiKeyUsage[options.key])
			apiKeyUsage[options.key].remaining = 0
		// if it's throttled, wait 10 seconds and try again
		await sleep(10000)
		return await sendApiRequest(path, options)
	}
	return response.data
}

// this is necessary for mocking in the tests because es6
export function mockSendApiRequest($value) { sendApiRequest = $value }
