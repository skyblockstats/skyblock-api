"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendApiRequest = exports.chooseApiKey = void 0;
/**
 * Fetch the raw Hypixel API
 */
const node_fetch_1 = __importDefault(require("node-fetch"));
const util_1 = require("./util");
const https_1 = require("https");
if (!process.env.hypixel_keys)
    // if there's no hypixel keys in env, run dotenv
    require('dotenv').config();
// We need to create an agent to prevent memory leaks and to only do dns lookups once
const httpsAgent = new https_1.Agent({
    keepAlive: true
});
/** This array should only ever contain one item because using multiple hypixel api keys isn't allowed :) */
const apiKeys = process.env.hypixel_keys.split(' ');
const apiKeyUsage = {};
const baseHypixelAPI = 'https://api.hypixel.net';
/** Choose the best current API key */
function chooseApiKey() {
    // find the api key with the lowest amount of uses
    let bestKeyUsage = null;
    let bestKey = null;
    for (var key of util_1.shuffle(apiKeys)) {
        const keyUsage = apiKeyUsage[key];
        // if the key has never been used before, use it
        if (!keyUsage)
            return key;
        // if the key has reset since the last use, set the remaining count to the default
        if (Date.now() > keyUsage.reset)
            keyUsage.remaining = keyUsage.limit;
        // if this key has more uses remaining than the current known best one, save it
        if (!bestKeyUsage || keyUsage.remaining > bestKeyUsage.remaining) {
            bestKeyUsage = keyUsage;
            bestKey = key;
        }
    }
    return bestKey;
}
exports.chooseApiKey = chooseApiKey;
/** Send an HTTP request to the Hypixel API */
async function sendApiRequest({ path, key, args }) {
    // Send a raw http request to api.hypixel.net, and return the parsed json
    if (key)
        // If there's an api key, add it to the arguments
        args.key = key;
    // Construct a url from the base api url, path, and arguments
    const fetchUrl = baseHypixelAPI + '/' + path + '?' + util_1.jsonToQuery(args);
    let fetchResponse;
    try {
        fetchResponse = await node_fetch_1.default(fetchUrl, { agent: () => httpsAgent });
    }
    catch {
        // if there's an error, wait a second and try again
        await new Promise((resolve) => setTimeout(resolve, 1000));
        return await sendApiRequest({ path, key, args });
    }
    if (fetchResponse.headers['ratelimit-limit'])
        // remember how many uses it has
        apiKeyUsage[key] = {
            remaining: fetchResponse.headers['ratelimit-remaining'],
            limit: fetchResponse.headers['ratelimit-limit'],
            reset: Date.now() + parseInt(fetchResponse.headers['ratelimit-reset']) * 1000
        };
    const fetchJsonParsed = await fetchResponse.json();
    if (fetchJsonParsed.throttle) {
        if (apiKeyUsage[key])
            apiKeyUsage[key].remaining = 0;
        return { throttled: true };
    }
    return fetchJsonParsed;
}
exports.sendApiRequest = sendApiRequest;
