"use strict";
/**
 * Fetch and edit constants from the skyblock-constants repo
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.addZones = exports.fetchZones = exports.addSkills = exports.fetchSkills = exports.addCollections = exports.fetchCollections = exports.addStats = exports.fetchStats = exports.addJSONConstants = void 0;
const node_fetch_1 = __importDefault(require("node-fetch"));
const https_1 = require("https");
const node_cache_1 = __importDefault(require("node-cache"));
const queue_promise_1 = __importDefault(require("queue-promise"));
const httpsAgent = new https_1.Agent({
    keepAlive: true
});
const githubApiBase = 'https://api.github.com';
const owner = 'skyblockstats';
const repo = 'skyblock-constants';
// we use a queue for editing so it doesnt hit the github ratelimit as much
const queue = new queue_promise_1.default({
    concurrent: 1,
    interval: 500
});
/**
 * Send a request to the GitHub API
 * @param method The HTTP method, for example GET, PUT, POST, etc
 * @param route The route to send the request to
 * @param headers The extra headers
 * @param json The JSON body, only applicable for some types of methods
 */
async function fetchGithubApi(method, route, headers, json) {
    return await node_fetch_1.default(githubApiBase + route, {
        agent: () => httpsAgent,
        body: json ? JSON.stringify(json) : null,
        method,
        headers: Object.assign({
            'Authorization': `token ${process.env.github_token}`
        }, headers),
    });
}
// cache files for an hour
const fileCache = new node_cache_1.default({
    stdTTL: 60 * 60,
    checkperiod: 60,
    useClones: false,
});
/**
 * Fetch a file from skyblock-constants
 * @param path The file path, for example stats.json
 */
async function fetchFile(path) {
    if (fileCache.has(path))
        return fileCache.get(path);
    const r = await fetchGithubApi('GET', `/repos/${owner}/${repo}/contents/${path}`, {
        'Accept': 'application/vnd.github.v3+json',
    });
    const data = await r.json();
    const file = {
        path: data.path,
        content: Buffer.from(data.content, data.encoding).toString(),
        sha: data.sha
    };
    fileCache.set(path, file);
    return file;
}
/**
 * Edit a file on skyblock-constants
 * @param file The GithubFile you got from fetchFile
 * @param message The commit message
 * @param newContent The new content in the file
 */
async function editFile(file, message, newContent) {
    const r = await fetchGithubApi('PUT', `/repos/${owner}/${repo}/contents/${file.path}`, { 'Content-Type': 'application/json' }, {
        message: message,
        content: Buffer.from(newContent).toString('base64'),
        sha: file.sha,
        branch: 'main'
    });
    const data = await r.json();
    fileCache.set(file.path, {
        path: data.content.path,
        content: newContent,
        sha: data.content.sha
    });
}
async function fetchJSONConstant(filename) {
    const file = await fetchFile(filename);
    try {
        return JSON.parse(file.content);
    }
    catch {
        // probably invalid json, return an empty array
        return [];
    }
}
/** Add stats to skyblock-constants. This has caching so it's fine to call many times */
async function addJSONConstants(filename, addingValues, units = 'stats') {
    if (addingValues.length === 0)
        return; // no stats provided, just return
    queue.enqueue(async () => {
        const file = await fetchFile(filename);
        if (!file.path)
            return;
        let oldStats;
        try {
            oldStats = JSON.parse(file.content);
        }
        catch {
            // invalid json, set it as an empty array
            oldStats = [];
        }
        const updatedStats = oldStats
            .concat(addingValues)
            // remove duplicates
            .filter((value, index, array) => array.indexOf(value) === index)
            .sort((a, b) => a.localeCompare(b));
        const newStats = updatedStats.filter(value => !oldStats.includes(value));
        // there's not actually any new stats, just return
        if (newStats.length === 0)
            return;
        const commitMessage = newStats.length >= 2 ? `Add ${newStats.length} new ${units}` : `Add '${newStats[0]}'`;
        await editFile(file, commitMessage, JSON.stringify(updatedStats, null, 2));
    });
}
exports.addJSONConstants = addJSONConstants;
/** Fetch all the known SkyBlock stats as an array of strings */
async function fetchStats() {
    return await fetchJSONConstant('stats.json');
}
exports.fetchStats = fetchStats;
/** Add stats to skyblock-constants. This has caching so it's fine to call many times */
async function addStats(addingStats) {
    await addJSONConstants('stats.json', addingStats, 'stats');
}
exports.addStats = addStats;
/** Fetch all the known SkyBlock collections as an array of strings */
async function fetchCollections() {
    return await fetchJSONConstant('collections.json');
}
exports.fetchCollections = fetchCollections;
/** Add collections to skyblock-constants. This has caching so it's fine to call many times */
async function addCollections(addingCollections) {
    await addJSONConstants('collections.json', addingCollections, 'collections');
}
exports.addCollections = addCollections;
/** Fetch all the known SkyBlock collections as an array of strings */
async function fetchSkills() {
    return await fetchJSONConstant('skills.json');
}
exports.fetchSkills = fetchSkills;
/** Add skills to skyblock-constants. This has caching so it's fine to call many times */
async function addSkills(addingSkills) {
    await addJSONConstants('skills.json', addingSkills, 'skills');
}
exports.addSkills = addSkills;
/** Fetch all the known SkyBlock collections as an array of strings */
async function fetchZones() {
    return await fetchJSONConstant('zones.json');
}
exports.fetchZones = fetchZones;
/** Add skills to skyblock-constants. This has caching so it's fine to call many times */
async function addZones(addingZones) {
    await addJSONConstants('zones.json', addingZones, 'zones');
}
exports.addZones = addZones;
