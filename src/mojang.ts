/**
 * Fetch the Mojang username API through api.ashcon.app
 */

import fetch from 'node-fetch'
import { Agent } from 'https'

// We need to create an agent to prevent memory leaks
const httpsAgent = new Agent({
	keepAlive: true
})

interface AshconHistoryItem {
	username: string
	changed_at?: string
}

interface AshconTextures {
	custom: boolean
	slim: boolean
	skin: { url: string, data: string }
	raw: { value: string, signature: string }
}

interface AshconResponse {
	uuid: string
	username: string
	username_history: AshconHistoryItem[]
	textures: AshconTextures
	created_at?: string
}

/**
 * Get mojang api data from ashcon.app
 */
export async function mojangDataFromUser(user: string): Promise<AshconResponse> {
    const fetchResponse = await fetch(
		'https://api.ashcon.app/mojang/v2/user/' + user,
		{ agent: () => httpsAgent }
	)
    return await fetchResponse.json()
}

/**
 * Fetch the uuid from a user
 * @param user A user can be either a uuid or a username 
 */
export async function uuidFromUser(user: string): Promise<string> {
    const fetchJSON = await mojangDataFromUser(user)
    return fetchJSON.uuid.replace(/-/g, '')
}

/**
 * Fetch the username from a user
 * @param user A user can be either a uuid or a username 
 */
export async function usernameFromUser(user: string): Promise<string> {
    // get a minecraft uuid from a username, using ashcon.app's mojang api
    const fetchJSON = await mojangDataFromUser(user)
    return fetchJSON.username
}

