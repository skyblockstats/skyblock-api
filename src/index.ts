import { fetchMemberProfile, fetchUser } from './hypixel'
import express from 'express'
import { fetchAllLeaderboardsCategorized, fetchMemberLeaderboard } from './database'

const app = express()

export const debug = false


app.use((req, res, next) => {
	if (process.env.key && req.headers.key !== process.env.key)
		// if a key is set in process.env and the header doesn't match return an error
		// TODO: make this have a status code
		return res.json({ error: 'Key in header must match key in env' })
	next()
})

app.get('/', async(req, res) => {
	res.json({ ok: true })
})

app.get('/player/:user', async(req, res) => {
	res.json(
		await fetchUser(
			{ user: req.params.user },
			['profiles', 'player']
		)
	)
})

app.get('/player/:user/:profile', async(req, res) => {
	res.json(
		await fetchMemberProfile(req.params.user, req.params.profile)
	)
})

app.get('/leaderboard/:name', async(req, res) => {
	res.json(
		await fetchMemberLeaderboard(req.params.name)
	)
})

app.get('/leaderboards', async(req, res) => {
	res.json(
		await fetchAllLeaderboardsCategorized()
	)
})



app.listen(8080, () => console.log('App started :)'))
