/**
 * Fetch and edit constants from the skyblock-constants repo
 */

import * as nodeFetch from 'node-fetch'
import NodeCache from 'node-cache'
import Queue from 'queue-promise'
import fetch from 'node-fetch'
import { Agent } from 'https'

const httpsAgent = new Agent({
	keepAlive: true
})

const githubApiBase = 'https://api.github.com'
const owner = 'skyblockstats'
const repo = 'skyblock-constants'

// we use a queue for editing so it always utilizes the cache if possible, and to avoid hitting the github rateimit
const queue = new Queue({
	concurrent: 1,
	interval: 10
})

/**
 * Send a request to the GitHub API
 * @param method The HTTP method, for example GET, PUT, POST, etc
 * @param route The route to send the request to
 * @param headers The extra headers
 * @param json The JSON body, only applicable for some types of methods
 */
async function fetchGithubApi(method: string, route: string, headers?: any, json?: any): Promise<nodeFetch.Response> {
	try {
		return await fetch(
			githubApiBase + route,
			{
				agent: () => httpsAgent,
				body: json ? JSON.stringify(json) : null,
				method,
				headers: Object.assign({
					'Authorization': `token ${process.env.github_token}`
				}, headers),
			}
		)
	} catch {
		// if there's an error, wait a second and try again
		await new Promise((resolve) => setTimeout(resolve, 1000))
		return await fetchGithubApi(method, route, headers, json)
	}
}

interface GithubFile {
	path: string
	content: string
	sha: string
}

// cache files for an hour
const fileCache = new NodeCache({
	stdTTL: 60 * 60,
	checkperiod: 60,
	useClones: false,
})


/**
 * Fetch a file from skyblock-constants
 * @param path The file path, for example stats.json
 */
function fetchFile(path: string): Promise<GithubFile> {
	return new Promise(resolve => {
		queue.enqueue(async() => {
			if (fileCache.has(path))
				return resolve(fileCache.get(path))

			const r = await fetchGithubApi(
				'GET',
				`/repos/${owner}/${repo}/contents/${path}`,
				{
					'Accept': 'application/vnd.github.v3+json',
				},
			)
			const data = await r.json()

			const file = {
				path: data.path,
				content: Buffer.from(data.content, data.encoding).toString(),
				sha: data.sha
			}
			fileCache.set(path, file)
			resolve(file)
		})
	})
}

/**
 * Edit a file on skyblock-constants
 * @param file The GithubFile you got from fetchFile
 * @param message The commit message
 * @param newContent The new content in the file
 */
async function editFile(file: GithubFile, message: string, newContent: string): Promise<void> {
	const r = await fetchGithubApi(
		'PUT',
		`/repos/${owner}/${repo}/contents/${file.path}`,
		{ 'Content-Type': 'application/json' },
		{
			message: message,
			content: Buffer.from(newContent).toString('base64'),
			sha: file.sha,
			branch: 'main'
		}
	)
	const data = await r.json()
	fileCache.set(file.path, {
		path: data.content.path,
		content: newContent,
		sha: data.content.sha
	})
}

async function fetchJSONConstant(filename: string): Promise<string[]> {
	const file = await fetchFile(filename)
	try {
		return JSON.parse(file.content)
	} catch {
		// probably invalid json, return an empty array
		return []
	}
}

/** Add stats to skyblock-constants. This has caching so it's fine to call many times */
export async function addJSONConstants(filename: string, addingValues: string[], unit: string='stat'): Promise<void> {
	if (addingValues.length === 0) return // no stats provided, just return

	let file: GithubFile = await fetchFile(filename)
	if (!file.path)
		return
	let oldStats: string[]
	try {
		oldStats = JSON.parse(file.content)
	} catch {
		// invalid json, set it as an empty array
		oldStats = []
	}
	const updatedStats = oldStats
		.concat(addingValues)
		// remove duplicates
		.filter((value, index, array) => array.indexOf(value) === index)
		.sort((a, b) => a.localeCompare(b))
	const newStats = updatedStats.filter(value => !oldStats.includes(value))

	// there's not actually any new stats, just return
	if (newStats.length === 0) return

	const commitMessage = newStats.length >= 2 ? `Add ${newStats.length} new ${unit}s` : `Add '${newStats[0]}' ${unit}`
	try {
		await editFile(file, commitMessage, JSON.stringify(updatedStats, null, 2))
	} catch {
		// the file probably changed or something, try again
		file = await fetchFile(filename)
		await editFile(file, commitMessage, JSON.stringify(updatedStats, null, 2))
	}
}


/** Fetch all the known SkyBlock stats as an array of strings */
export async function fetchStats(): Promise<string[]> {
	return await fetchJSONConstant('stats.json')
}

/** Add stats to skyblock-constants. This has caching so it's fine to call many times */
export async function addStats(addingStats: string[]): Promise<void> {
	await addJSONConstants('stats.json', addingStats, 'stat')
}

/** Fetch all the known SkyBlock collections as an array of strings */
export async function fetchCollections(): Promise<string[]> {
	return await fetchJSONConstant('collections.json')
}

/** Add collections to skyblock-constants. This has caching so it's fine to call many times */
export async function addCollections(addingCollections: string[]): Promise<void> {
	await addJSONConstants('collections.json', addingCollections, 'collection')
}

/** Fetch all the known SkyBlock collections as an array of strings */
export async function fetchSkills(): Promise<string[]> {
	return await fetchJSONConstant('skills.json')
}

/** Add skills to skyblock-constants. This has caching so it's fine to call many times */
export async function addSkills(addingSkills: string[]): Promise<void> {
	await addJSONConstants('skills.json', addingSkills, 'skill')
}

/** Fetch all the known SkyBlock collections as an array of strings */
export async function fetchZones(): Promise<string[]> {
	return await fetchJSONConstant('zones.json')
}

/** Add skills to skyblock-constants. This has caching so it's fine to call many times */
export async function addZones(addingZones: string[]): Promise<void> {
	await addJSONConstants('zones.json', addingZones, 'zone')
}


/** Fetch all the known SkyBlock slayer names as an array of strings */
export async function fetchSlayers(): Promise<string[]> {
	return await fetchJSONConstant('slayers.json')
}

/** Add skills to skyblock-constants. This has caching so it's fine to call many times */
export async function addSlayers(addingSlayers: string[]): Promise<void> {
	await addJSONConstants('slayers.json', addingSlayers, 'slayer')
}

/** Fetch all the known SkyBlock slayer names as an array of strings */
export async function fetchMinions(): Promise<string[]> {
	return await fetchJSONConstant('minions.json')
}

/** Add skills to skyblock-constants. This has caching so it's fine to call many times */
export async function addMinions(addingMinions: string[]): Promise<void> {
	await addJSONConstants('minions.json', addingMinions, 'minion')
}
