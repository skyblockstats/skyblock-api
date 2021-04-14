/**
 * Fetch the Mojang username API through api.ashcon.app
 */

import fetch from 'node-fetch'
import * as nodeFetch from 'node-fetch'
import { Agent } from 'https'
import { isUuid, undashUuid } from './util'

// We need to create an agent to prevent memory leaks
const httpsAgent = new Agent({
	keepAlive: true
})

interface MojangApiResponse {
	/** These uuids are already undashed */
	uuid: string

	username: string
}

/**
 * Get mojang api data from the session server
 */
export async function profileFromUuid(uuid: string): Promise<MojangApiResponse> {
	let fetchResponse: nodeFetch.Response

	try {
		fetchResponse = await fetch(
			// using mojang directly is faster than ashcon lol, also mojang removed the ratelimits from here
			`https://sessionserver.mojang.com/session/minecraft/profile/${undashUuid(uuid)}`,
			{ agent: () => httpsAgent }
		)
	} catch {
		// if there's an error, wait a second and try again
		await new Promise((resolve) => setTimeout(resolve, 1000))
		return await profileFromUuid(uuid)
	}

	let data
	try {
		data = await fetchResponse.json()
	} catch {
		// if it errors, just return null
		return { uuid: null, username: null }
	}
	return {
		uuid: data.id,
		username: data.name
	}
}


export async function profileFromUsername(username: string): Promise<MojangApiResponse> {
	// since we don't care about anything other than the uuid, we can use /uuid/ instead of /user/

	let fetchResponse: nodeFetch.Response

	try {
		fetchResponse = await fetch(
			`https://api.mojang.com/users/profiles/minecraft/${username}`,
			{ agent: () => httpsAgent }
		)
	} catch {
		// if there's an error, wait a second and try again
		await new Promise((resolve) => setTimeout(resolve, 1000))
		return await profileFromUsername(username)
	}

	let data
	try {
		data = await fetchResponse.json()
	} catch {
		return { uuid: null, username: null }
	}
	return {
		uuid: data.id,
		username: data.name
	}
}


export async function profileFromUser(user: string): Promise<MojangApiResponse> {
	if (isUuid(user)) {
		return await profileFromUuid(user)
	} else
		return await profileFromUsername(user)
}
