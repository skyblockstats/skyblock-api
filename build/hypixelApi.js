/**
 * Fetch the raw Hypixel API
 */
import { jsonToQuery, shuffle } from './util.js';
import fetch from 'node-fetch';
import { Agent } from 'https';
import Queue from 'queue-promise';
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
// we only do 30 concurrent requests so hypixel doesn't just drop our requests
const apiRequestQueue = new Queue({ concurrent: 30, interval: 10 });
/** Send an HTTP request to the Hypixel API */
export let sendApiRequest = async function sendApiRequest({ path, key, args }) {
    await new Promise(resolve => apiRequestQueue.enqueue(async () => resolve(null)));
    // Send a raw http request to api.hypixel.net, and return the parsed json
    let headers = {};
    if (key
        // keys arent required for skyblock/auctions
        && path !== 'skyblock/auctions')
        // If there's an api key, add it to the arguments
        headers['API-Key'] = key;
    // Construct a url from the base api url, path, and arguments
    const fetchUrl = baseHypixelAPI + '/' + path + '?' + jsonToQuery(args);
    let fetchResponse;
    let fetchJsonParsed;
    // the number of times it's retried the attempt
    let retries = 0;
    const maxRetries = 2;
    while (retries <= maxRetries) {
        try {
            fetchResponse = await fetch(fetchUrl, {
                agent: () => httpsAgent,
                headers
            });
            fetchJsonParsed = await fetchResponse.json();
            break;
        }
        catch (err) {
            console.warn(err);
            retries++;
            // too many retries, just throw the error
            if (retries > maxRetries)
                throw err;
        }
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
