globalThis.isTest = true

const hypixelCached = require('../build/hypixelCached')
const hypixelApi = require('../build/hypixelApi')
const constants = require('../build/constants')
const hypixel = require('../build/hypixel')
const mojang = require('../build/mojang')
const util = require('../build/util')
const assert = require('assert')
const path = require('path')
const fs = require('fs')


const cachedJsonData = {}

let requestsSent = 0

async function readJsonData(dir) {
	if (cachedJsonData[dir])
		return cachedJsonData[dir]

	const data = await fs.promises.readFile(path.join('test', 'data', dir + '.json'))
	const parsedData = JSON.parse(data)
	cachedJsonData[dir] = parsedData
	return parsedData
}

hypixelApi.sendApiRequest = async ({ path, key, args }) => {
	requestsSent ++
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

mojang.profileFromUuid = async (uuid) => {
	requestsSent ++
	const uuidToUsername = await readJsonData('mojang')
	const undashedUuid = undashUuid(uuid)
	const username = uuidToUsername[undashUuid(undashedUuid)]
	return { username, uuid: undashedUuid }
}
mojang.profileFromUsername = async (username) => {
	requestsSent ++
	const uuidToUsername = await readJsonData('mojang')
	const uuid = Object.keys(uuidToUsername).find(uuid => uuidToUsername[uuid] === username)
	return { username, uuid }
}
mojang.profileFromUser = async (user) => {
	if (util.isUuid(user))
		return await mojang.profileFromUuid(user)
	else
		return await mojang.profileFromUsername(user)
}

constants.addJSONConstants = async(filename, addingValues, unit) => {}
constants.fetchJSONConstant = async(filename) => {
	return await readJsonData('constants/' + filename.slice(0, filename.length - '.json'.length))
}


/** Clear all the current caches and stuff */
function resetState() {
	hypixelCached.usernameCache.flushAll()
	hypixelCached.basicProfilesCache.flushAll()
	hypixelCached.playerCache.flushAll()
	hypixelCached.basicPlayerCache.flushAll()
	hypixelCached.profileCache.flushAll()
	hypixelCached.profileNameCache.flushAll()
	requestsSent = 0
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
	describe('#fetchBasicPlayer()', () => {
		it('Checks user uuid and username', async() => {
			resetState()
			const user = await hypixelCached.fetchBasicPlayer('py5')
			assert.strictEqual(user.uuid, '6536bfed869548fd83a1ecd24cf2a0fd')
			assert.strictEqual(user.username, 'py5')
		})
		it('Checks the player\'s rank', async() => {
			resetState()
			const user = await hypixelCached.fetchBasicPlayer('py5')
			assert.strictEqual(user.rank.name, 'MVP+')
			assert.strictEqual(user.rank.color, '#3ffefe')
			assert.strictEqual(user.rank.colored, '§b[MVP§2+§b]')
		})
		it('Makes sure caching works properly', async() => {
			resetState()
			await hypixelCached.fetchBasicPlayer('py5')
			// 1 request to mojang, 1 request to hypixel
			assert.strictEqual(requestsSent, 2)
			await hypixelCached.fetchBasicPlayer('py5')
			// since it's caching, it should still be 2 requests
			assert.strictEqual(requestsSent, 2)
		})
	})

	describe('#fetchUser()', () => {
		it('Makes sure user.player exists', async() => {
			resetState()
			const user = await hypixel.fetchUser(
				{ user: 'py5' },
				['profiles', 'player']
			)
			assert.ok(user.player)
		})
	})
})



