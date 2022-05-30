globalThis.isTest = true

// we use `await import` instead of `import from` so globalThis.isTest is set before importing the modules
const { levelForSkillXp } = await import('../build/cleaners/skyblock/skills.js')
const hypixelCached = await import('../build/hypixelCached.js')
const hypixelApi = await import('../build/hypixelApi.js')
const constants = await import('../build/constants.js')
const hypixel = await import('../build/hypixel.js')
const mojang = await import('../build/mojang.js')
const util = await import('../build/util.js')
const assert = await import('assert')
const path = await import('path')
const fs = await import('fs')


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

hypixelApi.mockSendApiRequest(async (path, options) => {
	requestsSent++
	switch (path) {
		case 'player': {
			return await readJsonData(`player/${options.uuid}`)
		}
		case 'skyblock/profiles': {
			return await readJsonData(`skyblock/profiles/${options.uuid}`)
		}
		case 'resources/skyblock/items':
			return await readJsonData('resources/skyblock/items')
		case 'resources/achievements':
			return await readJsonData('resources/achievements')
	}
})

mojang.mockProfileFromUuid(async (uuid) => {
	requestsSent++
	const uuidToUsername = await readJsonData('mojang')
	const undashedUuid = undashUuid(uuid)
	const username = uuidToUsername[undashUuid(undashedUuid)]
	return { username, uuid: undashedUuid }
})
mojang.mockProfileFromUsername(async (username) => {
	requestsSent++
	const uuidToUsername = await readJsonData('mojang')
	const uuid = Object.keys(uuidToUsername).find(uuid => uuidToUsername[uuid] === username)
	return { username, uuid }
})
mojang.mockProfileFromUser(async (user) => {
	if (util.isUuid(user))
		return await mojang.profileFromUuid(user)
	else
		return await mojang.profileFromUsername(user)
})

constants.mockAddJSONConstants(async (filename, addingValues, unit) => { })
constants.mockFetchJSONConstant(async (filename) => {
	return await readJsonData('constants/' + filename.slice(0, filename.length - '.json'.length))
})


/** Clear all the current caches and stuff */
function resetState() {
	hypixelCached.usernameCache.flushAll()
	hypixelCached.basicProfilesCache.flushAll()
	hypixelCached.playerCache.flushAll()
	hypixelCached.basicPlayerCache.reset()
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
		it('Checks user uuid and username', async () => {
			resetState()
			const user = await hypixelCached.fetchBasicPlayer('py5')
			assert.strictEqual(user.uuid, '6536bfed869548fd83a1ecd24cf2a0fd')
			assert.strictEqual(user.username, 'py5')
		})
		it('Checks the player\'s rank', async () => {
			resetState()
			const user = await hypixelCached.fetchBasicPlayer('py5')
			assert.strictEqual(user.rank.name, 'MVP+')
			assert.strictEqual(user.rank.color, '#3ffefe')
			assert.strictEqual(user.rank.colored, '§b[MVP§2+§b]')
		})
		it('Makes sure caching works properly', async () => {
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
		it('Makes sure user.player exists', async () => {
			resetState()
			const user = await hypixel.fetchUser(
				{ user: 'py5' },
				['profiles', 'player']
			)
			assert.ok(user.player)
		})
	})
})

describe('Individual utility things', () => {
	describe('#levelForSkillXp()', () => {
		it('0 xp is level 0', () => assert.strictEqual(levelForSkillXp(0, 60), 0))
		it('49 xp is level 0', () => assert.strictEqual(levelForSkillXp(49, 60), 0))
		it('50 xp is level 1', () => assert.strictEqual(levelForSkillXp(50, 60), 1))
		it('174 xp is level 1', () => assert.strictEqual(levelForSkillXp(174, 60), 1))
		it('175 xp is level 2', () => assert.strictEqual(levelForSkillXp(175, 60), 2))
		it('176 xp is level 2', () => assert.strictEqual(levelForSkillXp(176, 60), 2))
		it('55172424 xp is level 49', () => assert.strictEqual(levelForSkillXp(55172424, 60), 49))
		it('55172425 xp is level 50', () => assert.strictEqual(levelForSkillXp(55172425, 60), 50))
		it('111672424 xp is level 59', () => assert.strictEqual(levelForSkillXp(111672424, 60), 59))
		it('111672425 xp is level 60', () => assert.strictEqual(levelForSkillXp(111672425, 60), 60))
		it('999999999 xp is level 60', () => assert.strictEqual(levelForSkillXp(999999999, 60), 60))

		it('0 xp is level 0 (max 25)', () => assert.strictEqual(levelForSkillXp(0, 25), 0))
		it('49 xp is level 0 (max 25)', () => assert.strictEqual(levelForSkillXp(49, 25), 0))
		it('50 xp is level 1 (max 25)', () => assert.strictEqual(levelForSkillXp(50, 25), 1))
		it('149 xp is level 1 (max 25)', () => assert.strictEqual(levelForSkillXp(149, 25), 1))
		it('150 xp is level 2 (max 25)', () => assert.strictEqual(levelForSkillXp(150, 25), 2))
		it('151 xp is level 2 (max 25)', () => assert.strictEqual(levelForSkillXp(151, 25), 2))
		it('94449 xp is level 24 (max 25)', () => assert.strictEqual(levelForSkillXp(94449, 25), 24))
		it('94450 xp is level 25 (max 25)', () => assert.strictEqual(levelForSkillXp(94450, 25), 25))
		it('99999 xp is level 25 (max 25)', () => assert.strictEqual(levelForSkillXp(99999, 25), 25))
	})
})

