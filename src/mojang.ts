/**
 * Fetch the Mojang username API through api.ashcon.app
 */

import { isUuid, undashUuid } from './util.js'
import * as nodeFetch from 'node-fetch'
import fetch from 'node-fetch'
import { Agent } from 'https'

// We need to create an agent to prevent memory leaks
const httpsAgent = new Agent({
	keepAlive: true
})

interface MojangApiResponse {
	/** These uuids are already undashed */
	uuid: string | null
	username: string | null
}

/**
 * Get mojang api data from the session server
 */
export let profileFromUuid = async function profileFromUuid(uuid: string): Promise<MojangApiResponse> {
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

	let dataString: string
	try {
		dataString = await fetchResponse.text()
	} catch (err) {
		return { uuid: null, username: null }
	}
	let data
	try {
		data = JSON.parse(dataString)
	} catch {
		// if it errors, just return null
		return { uuid: null, username: null }
	}
	return {
		uuid: data.id,
		username: data.name
	}
}


export let profileFromUsername = async function profileFromUsername(username: string): Promise<MojangApiResponse> {
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

	let data: any = null
	const rawData = await fetchResponse.text()
	try {
		data = JSON.parse(rawData)
	} catch {}


	if (!data?.id) {
		// return { uuid: null, username: null }
		return await profileFromUsernameAlternative(username)
	}

	return {
		uuid: data.id,
		username: data.name
	}
}

export async function profileFromUsernameAlternative(username: string): Promise<MojangApiResponse> {
	let fetchResponse: nodeFetch.Response

	try {
		fetchResponse = await fetch(
			`https://api.ashcon.app/mojang/v2/user/${username}`,
			{ agent: () => httpsAgent }
		)
	} catch {
		// if there's an error, wait a second and try again
		await new Promise((resolve) => setTimeout(resolve, 1000))
		return await profileFromUsernameAlternative(username)
	}

	let data
	try {
		data = await fetchResponse.json()
	} catch {
		return { uuid: null, username: null }
	}
	if (!data.uuid)
		return { uuid: null, username: null }
	return {
		uuid: undashUuid(data.uuid),
		username: data.username
	}
}

export let profileFromUser = async function profileFromUser(user: string): Promise<MojangApiResponse> {
	if (isUuid(user)) {
		return await profileFromUuid(user)
	} else
		return await profileFromUsername(user)
}


// this is necessary for mocking in the tests because es6
export function mockProfileFromUuid($value) { profileFromUuid = $value }
export function mockProfileFromUsername($value) { profileFromUsername = $value }
export function mockProfileFromUser($value) { profileFromUser = $value }
