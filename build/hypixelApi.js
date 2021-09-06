/**
 * Fetch the raw Hypixel API
 */
import fetch from 'node-fetch';
import { jsonToQuery, shuffle } from './util.js';
import { Agent } from 'https';
if (!process.env.hypixel_keys)
    // if there's no hypixel keys in env, run dotenv
    (await import('dotenv')).config();
// We need to create an agent to prevent memory leaks and to only do dns lookups once
const httpsAgent = new Agent({
    keepAlive: true
});
/** This array should only ever contain one item because using multiple hypixel api keys isn't allowed :) */
const apiKeys = process.env?.hypixel_keys?.split(' ') ?? [];
const apiKeyUsage = {};
const baseHypixelAPI = 'https://api.hypixel.net';
/** Choose the best current API key */
export function chooseApiKey() {
    // find the api key with the lowest amount of uses
    let bestKeyUsage = null;
    let bestKey = null;
    for (let key of shuffle(apiKeys.slice())) {
        const keyUsage = apiKeyUsage[key];
        // if the key has never been used before, use it
        if (!keyUsage)
            return key;
        // if the key has reset since the last use, set the remaining count to the default
        if (Date.now() > keyUsage.reset)
            keyUsage.remaining = keyUsage.limit;
        // if this key has more uses remaining than the current known best one, save it
        if (bestKeyUsage === null || keyUsage.remaining > bestKeyUsage.remaining) {
            bestKeyUsage = keyUsage;
            bestKey = key;
        }
    }
    return bestKey;
}
export function getKeyUsage() {
    let keyLimit = 0;
    let keyUsage = 0;
    for (let key of Object.values(apiKeyUsage)) {
        keyLimit += key.limit;
        keyUsage += key.limit - key.remaining;
    }
    return {
        limit: keyLimit,
        usage: keyUsage
    };
}
/** Send an HTTP request to the Hypixel API */
export let sendApiRequest = async function sendApiRequest({ path, key, args }) {
    // Send a raw http request to api.hypixel.net, and return the parsed json
    if (key)
        // If there's an api key, add it to the arguments
        args.key = key;
    // Construct a url from the base api url, path, and arguments
    const fetchUrl = baseHypixelAPI + '/' + path + '?' + jsonToQuery(args);
    let fetchResponse;
    let fetchJsonParsed;
    try {
        fetchResponse = await fetch(fetchUrl, { agent: () => httpsAgent });
        fetchJsonParsed = await fetchResponse.json();
    }
    catch {
        // if there's an error, wait a second and try again
        await new Promise((resolve) => setTimeout(resolve, 1000));
        return await sendApiRequest({ path, key, args });
    }
    // bruh
    if (fetchJsonParsed.cause === 'This endpoint is currently disabled') {
        await new Promise((resolve) => setTimeout(resolve, 30000));
        return await sendApiRequest({ path, key, args });
    }
    if (fetchResponse.headers.get('ratelimit-limit'))
        // remember how many uses it has
        apiKeyUsage[key] = {
            remaining: parseInt(fetchResponse.headers.get('ratelimit-remaining') ?? '0'),
            limit: parseInt(fetchResponse.headers.get('ratelimit-limit') ?? '0'),
            reset: Date.now() + parseInt(fetchResponse.headers.get('ratelimit-reset') ?? '0') * 1000
        };
    if (fetchJsonParsed.throttle) {
        if (apiKeyUsage[key])
            apiKeyUsage[key].remaining = 0;
        // if it's throttled, wait 10 seconds and try again
        await new Promise((resolve) => setTimeout(resolve, 10000));
        return await sendApiRequest({ path, key, args });
    }
    return fetchJsonParsed;
};
// this is necessary for mocking in the tests because es6
export function mockSendApiRequest($value) { sendApiRequest = $value; }
