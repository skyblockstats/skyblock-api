/**
 * Fetch the Mojang username API through api.ashcon.app
 */

import fetch from 'node-fetch'
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
	const fetchResponse = await fetch(
		// using mojang directly is faster than ashcon lol, also mojang removed the ratelimits from here
		`https://sessionserver.mojang.com/session/minecraft/profile/${undashUuid(uuid)}`,
		{ agent: () => httpsAgent }
	)
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
	const fetchResponse = await fetch(
		`https://api.mojang.com/users/profiles/minecraft/${username}`,
		{ agent: () => httpsAgent }
	)
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
