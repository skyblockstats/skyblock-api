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
export async function mojangDataFromUuid(uuid: string): Promise<MojangApiResponse> {
	console.log('mojangDataFromUuid', uuid)
	const fetchResponse = await fetch(
		// using mojang directly is faster than ashcon lol, also mojang removed the ratelimits from here
		`https://sessionserver.mojang.com/session/minecraft/profile/${undashUuid(uuid)}`,
		{ agent: () => httpsAgent }
	)
	const data = await fetchResponse.json()
	return {
		uuid: data.id,
		username: data.name
	}
}


export async function uuidFromUsername(username: string): Promise<string> {
	console.log('uuidFromUsername', username)
	// since we don't care about anything other than the uuid, we can use /uuid/ instead of /user/
	const fetchResponse = await fetch(
		`https://api.ashcon.app/mojang/v2/uuid/${username}`,
		{ agent: () => httpsAgent }
	)
	const userUuid = await fetchResponse.text()
	return userUuid.replace(/-/g, '')
}

export async function usernameFromUuid(uuid: string): Promise<string> {
	const userJson = await mojangDataFromUuid(uuid)
	return userJson.username
}




/**
 * Fetch the uuid from a user
 * @param user A user can be either a uuid or a username 
 */
export async function uuidFromUser(user: string): Promise<string> {
	if (isUuid(user))
		// already a uuid, just return it undashed
		return undashUuid(user)
	else
		return await uuidFromUsername(user)
}


export async function mojangDataFromUser(user: string): Promise<MojangApiResponse> {
	if (!isUuid(user))
		return await mojangDataFromUuid(await uuidFromUsername(user))
	else
		return await mojangDataFromUuid(user)
}

/**
 * Fetch the username from a user
 * @param user A user can be either a uuid or a username 
 */
export async function usernameFromUser(user: string): Promise<string> {
	// we do this to fix the capitalization
	const data = await mojangDataFromUser(user)
	return data.username
}

