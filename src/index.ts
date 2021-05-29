import { createSession, fetchAccount, fetchAccountFromDiscord, fetchAllLeaderboardsCategorized, fetchLeaderboard, fetchMemberLeaderboardSpots, fetchSession, updateAccount } from './database'
import { fetchMemberProfile, fetchUser } from './hypixel'
import rateLimit from 'express-rate-limit'
import * as constants from './constants'
import * as discord from './discord'
import express from 'express'

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
app.get('/', async(req, res) => {
	const currentTime = Date.now()
	res.json({
		ok: true,
		uptimeHours: (currentTime - startTime) / 1000 / 60 / 60
	})
})

app.get('/player/:user', async(req, res) => {
	try {
		res.json(
			await fetchUser(
				{ user: req.params.user },
				[req.query.basic as string === 'true' ? undefined : 'profiles', 'player'],
				req.query.customization as string === 'true'
			)
		)
	} catch (err) {
		console.error(err)
		res.json({ 'error': true })
	}
})

app.get('/discord/:id', async(req, res) => {
	res.json(
		await fetchAccountFromDiscord(req.params.id)
	)
})

app.get('/player/:user/:profile', async(req, res) => {
	try {
		res.json(
			await fetchMemberProfile(req.params.user, req.params.profile, req.query.customization as string === 'true')
		)
	} catch (err) {
		console.error(err)
		res.json({ 'error': true })
	}
})

app.get('/player/:user/:profile/leaderboards', async(req, res) => {
	res.json(
		await fetchMemberLeaderboardSpots(req.params.user, req.params.profile)
	)
})

app.get('/leaderboard/:name', async(req, res) => {
	try {
		res.json(
			await fetchLeaderboard(req.params.name)
		)
	} catch (err) {
		console.error(err)
		res.json({ 'error': err.toString() })
	}
})

app.get('/leaderboards', async(req, res) => {
	res.json(
		await fetchAllLeaderboardsCategorized()
	)
})

app.get('/constants', async(req, res) => {
	res.json(
		await constants.fetchConstantValues()
	)
})

app.post('/accounts/createsession', async(req, res) => {
	try {
		const { code } = req.body
		const { access_token: accessToken, refresh_token: refreshToken } = await discord.exchangeCode(`${mainSiteUrl}/loggedin`, code)
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

app.post('/accounts/session', async(req, res) => {
	try {
		const { uuid } = req.body
		const session = await fetchSession(uuid)
		const account = await fetchAccountFromDiscord(session.discord_user.id)
		res.json({ session, account })
	} catch (err) {
		console.error(err)
		res.json({ ok: false })
	}
})


app.post('/accounts/update', async(req, res) => {
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

// only run the server if it's not doing tests
if (!globalThis.isTest)
	app.listen(8080, () => console.log('App started :)'))
