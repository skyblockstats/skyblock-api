"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUser = exports.exchangeCode = void 0;
const node_fetch_1 = __importDefault(require("node-fetch"));
const https_1 = require("https");
const DISCORD_CLIENT_ID = '656634948148527107';
const httpsAgent = new https_1.Agent({
    keepAlive: true
});
async function exchangeCode(redirectUri, code) {
    const API_ENDPOINT = 'https://discord.com/api/v6';
    const CLIENT_SECRET = process.env.discord_client_secret;
    const data = {
        'client_id': DISCORD_CLIENT_ID,
        'client_secret': CLIENT_SECRET,
        'grant_type': 'authorization_code',
        'code': code,
        'redirect_uri': redirectUri,
        'scope': 'identify'
    };
    console.log(new URLSearchParams(data).toString());
    const fetchResponse = await node_fetch_1.default(API_ENDPOINT + '/oauth2/token', {
        method: 'POST',
        agent: () => httpsAgent,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(data).toString()
    });
    return await fetchResponse.json();
}
exports.exchangeCode = exchangeCode;
async function getUser(accessToken) {
    const API_ENDPOINT = 'https://discord.com/api/v6';
    const response = await node_fetch_1.default(API_ENDPOINT + '/users/@me', {
        headers: { 'Authorization': 'Bearer ' + accessToken },
        agent: () => httpsAgent,
    });
    return response.json();
}
exports.getUser = getUser;
