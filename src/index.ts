import { createSession, fetchAccountFromDiscord, fetchAllLeaderboardsCategorized, fetchLeaderboard, fetchMemberLeaderboardSpots, fetchSession, finishedCachingRawLeaderboards, leaderboardUpdateMemberQueue, leaderboardUpdateProfileQueue, updateAccount, fetchServerStatus } from './database.js'
import { fetchMemberProfile, fetchUser } from './hypixel.js'
import rateLimit from 'express-rate-limit'
import * as constants from './constants.js'
import * as discord from './discord.js'
import express from 'express'
import { getKeyUsage } from './hypixelApi.js'
import { basicPlayerCache, basicProfilesCache, playerCache, profileCache, profileNameCache, profilesCache, usernameCache } from './hypixelCached.js'
import { register } from './metrics.js'

const app = express()

export const debug = false

const mainSiteUrl = 'https://skyblock.matdoes.dev'

// 200 requests over 5 minutes
const limiter = rateLimit({
	windowMs: 60 * 1000 * 5,
	max: 200,
	skip: (req: express.Request) => {
		return req.headers.key === process.env.key
	},
	keyGenerator: (req: express.Request) => {
		return (req.headers['cf-connecting-ip'] ?? req.ip).toString()
	}
})

app.use(limiter)
app.use(express.json())
app.use((req, res, next) => {
	res.setHeader('Access-Control-Allow-Origin', '*')
	next()
})

const startTime = Date.now()
app.get('/', async (req, res) => {
	const currentTime = Date.now()
	let data: any = {
		ok: true,
		uptimeHours: (currentTime - startTime) / 1000 / 60 / 60,
		finishedCachingRawLeaderboards,
		leaderboardUpdateMemberQueueSize: leaderboardUpdateMemberQueue.size,
		leaderboardUpdateProfileQueueSize: leaderboardUpdateProfileQueue.size,

		usernameCacheSize: usernameCache.keys().length,
		basicProfilesCacheSize: basicProfilesCache.keys().length,
		playerCacheSize: playerCache.keys().length,
		basicPlayerCacheSize: basicPlayerCache.keys().length,
		profileCacheSize: profileCache.keys().length,
		profilesCacheSize: profilesCache.keys().length,
		profileNameCacheSize: profileNameCache.keys().length,
	}
	if (req.headers.key === process.env.key)
		data.key = getKeyUsage()
	res.json(data)
})

app.get('/player/:user', async (req, res) => {
	try {
		const user = await fetchUser(
			{ user: req.params.user },
			[req.query.basic as string === 'true' ? undefined : 'profiles', 'player'],
			req.query.customization as string === 'true'
		)
		if (user)
			res.json(user)
		else
			res.status(404).json({ error: true })
	} catch (err) {
		console.error(err)
		res.json({ error: true })
	}
})

app.get('/discord/:id', async (req, res) => {
	try {
		res.json(
			await fetchAccountFromDiscord(req.params.id)
		)
	} catch (err) {
		console.error(err)
		res.json({ ok: false })
	}
})

app.get('/player/:user/:profile', async (req, res) => {
	try {
		const profile = await fetchMemberProfile(req.params.user, req.params.profile, req.query.customization as string === 'true')
		if (profile)
			res.json(profile)
		else
			res.status(404).json({ error: true })
	} catch (err) {
		console.error(err)
		res.json({ error: true })
	}
})

app.get('/player/:user/:profile/leaderboards', async (req, res) => {
	try {
		res.json(
			await fetchMemberLeaderboardSpots(req.params.user, req.params.profile)
		)
	} catch (err) {
		console.error(err)
		res.json({ ok: false })
	}
})

app.get('/leaderboard/:name', async (req, res) => {
	try {
		res.json(
			await fetchLeaderboard(req.params.name)
		)
	} catch (err) {
		console.error(err)
		res.json({ 'error': err.toString() })
	}
})

app.get('/leaderboards', async (req, res) => {
	try {
		res.json(
			await fetchAllLeaderboardsCategorized()
		)
	} catch (err) {
		console.error(err)
		res.json({ ok: false })
	}
})

app.get('/constants', async (req, res) => {
	try {
		res.json(
			await constants.fetchConstantValues()
		)
	} catch (err) {
		console.error(err)
		res.json({ ok: false })
	}
})

app.post('/accounts/createsession', async (req, res) => {
	try {
		const { code } = req.body
		const codeExchange = await discord.exchangeCode(`${mainSiteUrl}/loggedin`, code)
		if (!codeExchange) {
			res.json({ ok: false, error: 'discord_client_secret isn\'t in env' })
			return
		}
		const { access_token: accessToken, refresh_token: refreshToken } = codeExchange
		if (!accessToken)
			// access token is invalid :(
			return res.json({ ok: false })
		const userData = await discord.getUser(accessToken)
		const sessionId = await createSession(refreshToken, userData)
		res.json({ ok: true, session_id: sessionId })
	} catch (err) {
		res.json({ ok: false })
	}
})

app.post('/accounts/session', async (req, res) => {
	try {
		const { uuid } = req.body
		const session = await fetchSession(uuid)
		if (!session)
			return res.json({ ok: false })
		const account = await fetchAccountFromDiscord(session.discord_user.id)
		res.json({ session, account })
	} catch (err) {
		console.error(err)
		res.json({ ok: false })
	}
})


app.post('/accounts/update', async (req, res) => {
	// it checks against the key, so it's kind of secure
	if (req.headers.key !== process.env.key) return console.log('bad key!')
	try {
		await updateAccount(req.body.discordId, req.body)
		res.json({ ok: true })
	} catch (err) {
		console.error(err)
		res.json({ ok: false })
	}
})


app.get('/metrics', async (req, res) => {
	if (!req.headers.host?.startsWith('0.0.0.0:'))
		return res.status(403).send('Forbidden')
	try {
		res.set('Content-Type', register.contentType)
		res.end(await register.metrics())
	} catch (err) {
		res.status(500).end(err)
	}
})

process.on('uncaughtException', err => console.error(err))
process.on('unhandledRejection', (err, promise) => console.error(promise, err))

// only run the server if it's not doing tests
if (!globalThis.isTest)
	app.listen(8080, () => console.log('App started :)'))
