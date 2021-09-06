import fetch from 'node-fetch';
import { Agent } from 'https';
const DISCORD_CLIENT_ID = '656634948148527107';
const httpsAgent = new Agent({
    keepAlive: true
});
export async function exchangeCode(redirectUri, code) {
    const API_ENDPOINT = 'https://discord.com/api/v6';
    const CLIENT_SECRET = process.env.discord_client_secret;
    if (!CLIENT_SECRET) {
        console.error('discord_client_secret isn\'t in env, couldn\'t login with discord');
        return null;
    }
    const data = {
        'client_id': DISCORD_CLIENT_ID,
        'client_secret': CLIENT_SECRET,
        'grant_type': 'authorization_code',
        'code': code,
        'redirect_uri': redirectUri,
        'scope': 'identify'
    };
    const fetchResponse = await fetch(API_ENDPOINT + '/oauth2/token', {
        method: 'POST',
        agent: () => httpsAgent,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(data).toString()
    });
    return await fetchResponse.json();
}
export async function getUser(accessToken) {
    const API_ENDPOINT = 'https://discord.com/api/v6';
    const response = await fetch(API_ENDPOINT + '/users/@me', {
        headers: { 'Authorization': 'Bearer ' + accessToken },
        agent: () => httpsAgent,
    });
    return await response.json();
}
