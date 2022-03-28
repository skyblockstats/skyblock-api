/**
 * Automatically generate Hypixel API responses for the unit tests
 */

globalThis.isTest = true

import typedHypixelApi from 'typed-hypixel-api'
import * as hypixelApi from '../src/hypixelApi'
import * as constants from '../src/constants'
import * as mojang from '../src/mojang'
import fs from 'fs/promises'
import path from 'path'


const playerUuids = [
	'6536bfed869548fd83a1ecd24cf2a0fd', // py5
	'4133cab5a7534f3f9bb636fc06a1f0fd', // LostEJ
	'ef3bb867eec048a1a9b92b451f0ffc66', // NMART
	'e403573808ad45ddb5c48ec7c4db0144', // Dededecent
]

async function writeTestData(requestPath: string, name: string, contents: any) {
	const dir = path.join(process.cwd(), '..', 'test', 'data', requestPath)
	await fs.mkdir(path.dirname(path.join(dir, `${name}.json`)), { recursive: true })
	await fs.writeFile(path.join(dir, `${name}.json`), JSON.stringify(contents, null, 2))
}

async function addResponse(requestPath: keyof typedHypixelApi.Requests, args: { [key: string]: string }, name: string) {
	console.log('Fetching', requestPath, args)
	const response = await hypixelApi.sendApiRequest(requestPath, {
		key: hypixelApi.chooseApiKey(),
		...args,
	})
	await writeTestData(requestPath, name, response)
}


async function addConstants() {
	const constantNames = [
		'collections',
		'minions',
		'pets',
		'skills',
		'slayers',
		'stats',
		'values',
		'zones',
	]
	for (const constantName of constantNames) {
		const constantData = await constants.fetchJSONConstant(constantName + '.json')
		await writeTestData('constants', constantName, constantData)
	}
	const constantValues = await constants.fetchConstantValues()
	await writeTestData('constants', 'values', constantValues)
}

async function main() {
	const uuidsToUsername = {}
	for (const playerUuid of playerUuids) {
		await addResponse('player', { uuid: playerUuid }, playerUuid)
		await addResponse('skyblock/profiles', { uuid: playerUuid }, playerUuid)
		const { username: playerUsername } = await mojang.profileFromUuid(playerUuid)
		uuidsToUsername[playerUuid] = playerUsername
	}

	await writeTestData('', 'mojang', uuidsToUsername)

	await addConstants()
}

main()