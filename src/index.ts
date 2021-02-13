import express from 'express'
import { fetchMemberProfile, fetchUser } from './hypixel'
import { fetchProfile } from './hypixelCached'

const app = express()


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

app.listen(8080, () => console.log('App started :)'))