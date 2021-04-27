const assert = require('assert')
const database = require('../build/database')
const hypixelApi = require('../build/hypixelApi')
const hypixelCached = require('../build/hypixelCached')
const hypixel = require('../build/hypixel')
const util = require('../build/util')
const mojang = require('../build/mojang')
const fs = require('fs')
const path = require('path')

process.env.db_uri = null
process.env.db_name = null

const cachedJsonData = {}

async function readJsonData(dir) {
	if (cachedJsonData[dir])
		return cachedJsonData[dir]

	const data = await fs.promises.readFile(path.join('test', 'data', dir + '.json'))
	const parsedData = JSON.parse(data)
	cachedJsonData[dir] = parsedData
	return parsedData
}

hypixelApi.sendApiRequest = async({ path, key, args }) => {
	switch (path) {
		case 'player': {
			return await readJsonData(`player/${args.uuid}`)
		}
		case 'skyblock/profiles': {
			return await readJsonData(`skyblock/profiles/${args.uuid}`)
		}
	}
	console.log(path, args)
}
mojang.profileFromUuid = async(uuid) => {
	const uuidToUsername = await readJsonData('mojang')
	return uuidToUsername[undashUuid(uuid)]
}
mojang.profileFromUsername = async(username) => {
	const uuidToUsername = await readJsonData('mojang')
	return uuidToUsername.find(uuid => uuidToUsername[uuid] === username)
}

describe('util', () => {
	describe('#undashUuid()', () => {
		it('Undashes correctly', () => {
			assert.strictEqual(util.undashUuid('6536bfed-8695-48fd-83a1-ecd24cf2a0fd'), '6536bfed869548fd83a1ecd24cf2a0fd')
		})
		it('Lowercases correctly', () => {
			assert.strictEqual(util.undashUuid('6536BFED-8695-48FD-83A1-ECD24CF2A0FD'), '6536bfed869548fd83a1ecd24cf2a0fd')
		})
	})
	describe('#jsonToQuery()', () => {
		it('Creates correct query', () => {
			assert.strictEqual(util.jsonToQuery({ 'hello': 'world' }), 'hello=world')
		})
		it('Creates correct query for multiple', () => {
			assert.strictEqual(util.jsonToQuery({ 'hello': 'world', 'asdf': 'fdsa' }), 'hello=world&asdf=fdsa')
		})
	})
	describe('#isUuid()', () => {
		it('Detects correct undashed uuid', () => {
			assert.ok(util.isUuid('6536bfed869548fd83a1ecd24cf2a0fd'))
		})
		it('Detects correct dashed uuid', () => {
			assert.ok(util.isUuid('6536bfed-8695-48fd-83a1-ecd24cf2a0fd'))
		})
		it('Detects correct dashed and capitalized uuid', () => {
			assert.ok(util.isUuid('6536BFED-8695-48FD-83A1-ECD24CF2A0FD'))
		})
		it('Detects bad uuid that\'s too long', () => {
			assert.ok(!util.isUuid('6536bfed869548fd83a1ecd24cf2a0fda'))
		})
		it('Detects bad uuid that\'s too short', () => {
			assert.ok(!util.isUuid('6536bfed869548fd83a1ecd24cf2a0f'))
		})
	})
})

describe('hypixel', () => {
	describe('#fetchUser()', () => {
		it('Make sure user exists', async() => {
			hypixelCached.clearCaches()
			const user = await hypixel.fetchUser(
				{ user: 'py5' },
				['profiles', 'player']
			)
			assert.ok(user.player)
		})
	})
})



