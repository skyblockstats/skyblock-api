import { fetchAllLeaderboardsCategorized, fetchLeaderboard, fetchMemberLeaderboardSpots } from './database'
import { fetchMemberProfile, fetchUser } from './hypixel'
import rateLimit from 'express-rate-limit'
import express from 'express'

const app = express()

export const debug = false


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
app.use((req, res, next) => {
	res.setHeader('Access-Control-Allow-Origin', '*')
	next()
})

app.get('/', async(req, res) => {
	res.json({ ok: true })
})

app.get('/player/:user', async(req, res) => {
	res.json(
		await fetchUser(
			{ user: req.params.user },
			[req.query.basic as string === 'true' ? undefined : 'profiles', 'player']
		)
	)
})

app.get('/player/:user/:profile', async(req, res) => {
	res.json(
		await fetchMemberProfile(req.params.user, req.params.profile)
	)
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


// only run the server if it's not doing tests
if (!globalThis.isTest)
	app.listen(8080, () => console.log('App started :)'))
