/**
 * Fetch and edit constants from the skyblock-constants repo
 */

// we have to do this so we can mock the function from the tests properly
import * as constants from './constants.js'

import * as nodeFetch from 'node-fetch'
import NodeCache from 'node-cache'
import { debug } from './index.js'
import Queue from 'queue-promise'
import fetch from 'node-fetch'
import { Agent } from 'https'
import { CollectionNames } from './cleaners/skyblock/collections.js'

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
		if (debug) console.debug('fetching github api', method, route)
		const data = await fetch(
			githubApiBase + route,
			{
				agent: () => httpsAgent,
				body: json ? JSON.stringify(json) : undefined,
				method,
				headers: Object.assign({
					'Authorization': `token ${process.env.github_token}`
				}, headers),
			}
		)
		if (debug) console.debug('fetched github api', method, route)
		return data
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
		queue.enqueue(async () => {
			if (fileCache.has(path))
				return resolve(fileCache.get(path)!)

			const r = await fetchGithubApi(
				'GET',
				`/repos/${owner}/${repo}/contents/${path}`,
				{
					'Accept': 'application/vnd.github.v3+json',
				},
			)
			const data = await r.json() as any

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
	const data = await r.json() as any
	fileCache.set(file.path, {
		path: data.content.path,
		content: newContent,
		sha: data.content.sha
	})
}

export let fetchJSONConstant = async function fetchJSONConstant(filename: string): Promise<any> {
	const file = await fetchFile(filename)
	try {
		return JSON.parse(file.content)
	} catch {
		// probably invalid json, return an empty array
		return []
	}
}

/** Add stats to skyblock-constants. This has caching so it's fine to call many times */
export let addJSONConstants = async function addJSONConstants(filename: string, addingValues: string[], unit: string = 'stat'): Promise<void> {
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
	return await constants.fetchJSONConstant('stats.json')
}

/** Add stats to skyblock-constants. This has caching so it's fine to call many times */
export async function addStats(addingStats: string[]): Promise<void> {
	await constants.addJSONConstants('stats.json', addingStats, 'stat')
}

/** Fetch all the known SkyBlock collections as an array of strings */
export async function fetchCollections(): Promise<string[]> {
	return await constants.fetchJSONConstant('collections.json')
}

/** Add collections to skyblock-constants. This has caching so it's fine to call many times */
export async function addCollections(addingCollections: string[]): Promise<void> {
	await constants.addJSONConstants('collections.json', addingCollections, 'collection')
}

/** Fetch all the known SkyBlock collections as an array of strings */
export async function fetchSkills(): Promise<string[]> {
	return await constants.fetchJSONConstant('skills.json')
}

/** Add skills to skyblock-constants. This has caching so it's fine to call many times */
export async function addSkills(addingSkills: string[]): Promise<void> {
	await constants.addJSONConstants('skills.json', addingSkills, 'skill')
}

/** Fetch all the known SkyBlock collections as an array of strings */
export async function fetchZones(): Promise<string[]> {
	return await constants.fetchJSONConstant('zones.json')
}

/** Add skills to skyblock-constants. This has caching so it's fine to call many times */
export async function addZones(addingZones: string[]): Promise<void> {
	await constants.addJSONConstants('zones.json', addingZones, 'zone')
}


/** Fetch all the known SkyBlock slayer names as an array of strings */
export async function fetchSlayers(): Promise<string[]> {
	return await constants.fetchJSONConstant('slayers.json')
}

/** Add skills to skyblock-constants. This has caching so it's fine to call many times */
export async function addSlayers(addingSlayers: string[]): Promise<void> {
	await constants.addJSONConstants('slayers.json', addingSlayers, 'slayer')
}

/** Fetch all the known SkyBlock slayer names as an array of strings */
export async function fetchMinions(): Promise<string[]> {
	return await constants.fetchJSONConstant('minions.json')
}


/** Add skills to skyblock-constants. This has caching so it's fine to call many times */
export async function addMinions(addingMinions: string[]): Promise<void> {
	await constants.addJSONConstants('minions.json', addingMinions, 'minion')
}

interface constantValues {
	max_minions?: number
	max_fairy_souls?: number
}

export async function fetchConstantValues(): Promise<constantValues> {
	return await constants.fetchJSONConstant('values.json')
}

/** The xp required to level up for each collection. If it's unknown, it's left as null */
export async function fetchCollectionXpTable(): Promise<{ [ key in CollectionNames ]: (number | null)[] | undefined }> {
	const file = await fetchFile('collection_xp.json')
	const data = JSON.parse(file.content)
	return data
}

export async function updateCollectionXpTable(updates: JsonXpTableUpdate[]): Promise<void> {
	await updateJSONXpTable('collection_xp.json', updates)
}

export async function setConstantValues(newValues: constantValues) {
	let file: GithubFile = await fetchFile('values.json')
	if (!file.path) return
	let oldValues: constantValues
	try {
		oldValues = JSON.parse(file.content)
	} catch {
		// invalid json, set it as an empty array
		oldValues = {}
	}
	const updatedStats = { ...oldValues, ...newValues }

	// there's not actually any new stats, just return
	// TODO: optimize this? might be fine already though, idk
	if (JSON.stringify(updatedStats) === JSON.stringify(oldValues)) return

	const commitMessage = 'Update values'
	try {
		await editFile(file, commitMessage, JSON.stringify(updatedStats, null, 2))
	} catch { }
}


// this is necessary for mocking in the tests because es6
export function mockAddJSONConstants($value) { addJSONConstants = $value }
export function mockFetchJSONConstant($value) { fetchJSONConstant = $value }

export interface JsonXpTableUpdate {
	name: string
	level: number
	xp: number
}

export async function updateJSONXpTable(filename: string, updates: JsonXpTableUpdate[]): Promise<void> {
	if (updates.length === 0) return // no stats provided, just return

	let file: GithubFile = await fetchFile(filename)
	if (!file.path)
		// the file doesn't exist, just return
		return

	let oldTable: Record<string, number[]>
	// the updatedTable starts the same as the oldTable
	let updatedTable: Record<string, number[]>
	try {
		oldTable = JSON.parse(file.content)
		updatedTable = JSON.parse(file.content)
	} catch {
		// invalid json, set it as an empty object
		oldTable = {}
		updatedTable = {}
	}

	let updatedCount = 0

	// now, we iterate over `updates` and see what we can apply
	for (const update of updates) {
		// if the update is for a level that's already in the table, check if it's lower and update it
		let xpList = updatedTable[update.name]
		if (xpList) {
			if (xpList[update.level - 1] !== null) {
				// the xp is already set, check if it's lower
				if (update.xp < xpList[update.level - 1]) {
					xpList[update.level - 1] = update.xp
					updatedCount ++
				}
			} else {
				// the xp is not set, just set it
				xpList[update.level - 1] = update.xp
				updatedCount ++
			}
		} else {
			// the xp list doesn't exist, create it
			xpList = []
			xpList[update.level - 1] = update.xp
			updatedTable[update.name] = xpList
			updatedCount ++
		}
	}
	
	// there's not actually any difference, just return
	if (updatedCount === 0) return

	const commitMessage = updatedCount >= 2 ? `Updated ${updatedCount} level xps` : `Updated 1 level xp`
	try {
		await editFile(file, commitMessage, JSON.stringify(updatedTable, null, 2))
	} catch {
		// the file probably changed or something, try again
		file = await fetchFile(filename)
		await editFile(file, commitMessage, JSON.stringify(updatedTable, null, 2))
	}
}