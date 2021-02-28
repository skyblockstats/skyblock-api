"use strict";
/**
 * Fetch and edit constants from the skyblock-constants repo
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.addStats = exports.fetchStats = void 0;
const node_fetch_1 = __importDefault(require("node-fetch"));
const https_1 = require("https");
const node_cache_1 = __importDefault(require("node-cache"));
const httpsAgent = new https_1.Agent({
    keepAlive: true
});
const githubApiBase = 'https://api.github.com';
const owner = 'skyblockstats';
const repo = 'skyblock-constants';
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
// cache files for a day
const fileCache = new node_cache_1.default({
    stdTTL: 60 * 60 * 24,
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
    const r = await fetchGithubApi('GET', `/repos/${owner}/${repo}/contents/${path}`, { 'Accept': 'application/vnd.github.v3+json' });
    const data = await r.json();
    return {
        path: data.path,
        content: Buffer.from(data.content, data.encoding).toString(),
        sha: data.sha
    };
}
/**
 * Edit a file on skyblock-constants
 * @param file The GithubFile you got from fetchFile
 * @param message The commit message
 * @param newContent The new content in the file
 */
async function editFile(file, message, newContent) {
    fileCache.set(file.path, newContent);
    await fetchGithubApi('PUT', `/repos/${owner}/${repo}/contents/${file.path}`, { 'Content-Type': 'application/json' }, {
        message: message,
        content: Buffer.from(newContent).toString('base64'),
        sha: file.sha,
        branch: 'main'
    });
}
/** Fetch all the known SkyBlock stats as an array of strings */
async function fetchStats() {
    const file = await fetchFile('stats.json');
    try {
        return JSON.parse(file.content);
    }
    catch {
        // probably invalid json, return an empty array
        return [];
    }
}
exports.fetchStats = fetchStats;
/** Add stats to skyblock-constants. This has caching so it's fine to call many times */
async function addStats(addingStats) {
    if (addingStats.length === 0)
        return; // no stats provided, just return
    const file = await fetchFile('stats.json');
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
        .concat(addingStats)
        // remove duplicates
        .filter((value, index, array) => array.indexOf(value) === index)
        .sort((a, b) => a.localeCompare(b));
    const newStats = updatedStats.filter(value => !oldStats.includes(value));
    // there's not actually any new stats, just return
    if (newStats.length === 0)
        return;
    const commitMessage = newStats.length >= 2 ? `Add ${newStats.length} new stats` : `Add '${newStats[0]}'`;
    await editFile(file, commitMessage, JSON.stringify(updatedStats, null, 2));
}
exports.addStats = addStats;
