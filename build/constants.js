"use strict";
/**
 * Fetch and edit constants from the skyblock-constants repo
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setConstantValues = exports.fetchConstantValues = exports.addMinions = exports.fetchMinions = exports.addSlayers = exports.fetchSlayers = exports.addZones = exports.fetchZones = exports.addSkills = exports.fetchSkills = exports.addCollections = exports.fetchCollections = exports.addStats = exports.fetchStats = exports.addJSONConstants = exports.fetchJSONConstant = void 0;
// we have to do this so we can mock the function from the tests properly
const constants = __importStar(require("./constants"));
const node_cache_1 = __importDefault(require("node-cache"));
const queue_promise_1 = __importDefault(require("queue-promise"));
const node_fetch_1 = __importDefault(require("node-fetch"));
const https_1 = require("https");
const _1 = require(".");
const httpsAgent = new https_1.Agent({
    keepAlive: true
});
const githubApiBase = 'https://api.github.com';
const owner = 'skyblockstats';
const repo = 'skyblock-constants';
// we use a queue for editing so it always utilizes the cache if possible, and to avoid hitting the github rateimit
const queue = new queue_promise_1.default({
    concurrent: 1,
    interval: 10
});
/**
 * Send a request to the GitHub API
 * @param method The HTTP method, for example GET, PUT, POST, etc
 * @param route The route to send the request to
 * @param headers The extra headers
 * @param json The JSON body, only applicable for some types of methods
 */
async function fetchGithubApi(method, route, headers, json) {
    try {
        if (_1.debug)
            console.debug('fetching github api', method, route);
        return await node_fetch_1.default(githubApiBase + route, {
            agent: () => httpsAgent,
            body: json ? JSON.stringify(json) : null,
            method,
            headers: Object.assign({
                'Authorization': `token ${process.env.github_token}`
            }, headers),
        });
    }
    catch {
        // if there's an error, wait a second and try again
        await new Promise((resolve) => setTimeout(resolve, 1000));
        return await fetchGithubApi(method, route, headers, json);
    }
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
function fetchFile(path) {
    return new Promise(resolve => {
        queue.enqueue(async () => {
            if (fileCache.has(path))
                return resolve(fileCache.get(path));
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
            resolve(file);
        });
    });
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
exports.fetchJSONConstant = fetchJSONConstant;
/** Add stats to skyblock-constants. This has caching so it's fine to call many times */
async function addJSONConstants(filename, addingValues, unit = 'stat') {
    if (addingValues.length === 0)
        return; // no stats provided, just return
    let file = await fetchFile(filename);
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
    const commitMessage = newStats.length >= 2 ? `Add ${newStats.length} new ${unit}s` : `Add '${newStats[0]}' ${unit}`;
    try {
        await editFile(file, commitMessage, JSON.stringify(updatedStats, null, 2));
    }
    catch {
        // the file probably changed or something, try again
        file = await fetchFile(filename);
        await editFile(file, commitMessage, JSON.stringify(updatedStats, null, 2));
    }
}
exports.addJSONConstants = addJSONConstants;
/** Fetch all the known SkyBlock stats as an array of strings */
async function fetchStats() {
    return await constants.fetchJSONConstant('stats.json');
}
exports.fetchStats = fetchStats;
/** Add stats to skyblock-constants. This has caching so it's fine to call many times */
async function addStats(addingStats) {
    await constants.addJSONConstants('stats.json', addingStats, 'stat');
}
exports.addStats = addStats;
/** Fetch all the known SkyBlock collections as an array of strings */
async function fetchCollections() {
    return await constants.fetchJSONConstant('collections.json');
}
exports.fetchCollections = fetchCollections;
/** Add collections to skyblock-constants. This has caching so it's fine to call many times */
async function addCollections(addingCollections) {
    await constants.addJSONConstants('collections.json', addingCollections, 'collection');
}
exports.addCollections = addCollections;
/** Fetch all the known SkyBlock collections as an array of strings */
async function fetchSkills() {
    return await constants.fetchJSONConstant('skills.json');
}
exports.fetchSkills = fetchSkills;
/** Add skills to skyblock-constants. This has caching so it's fine to call many times */
async function addSkills(addingSkills) {
    await constants.addJSONConstants('skills.json', addingSkills, 'skill');
}
exports.addSkills = addSkills;
/** Fetch all the known SkyBlock collections as an array of strings */
async function fetchZones() {
    return await constants.fetchJSONConstant('zones.json');
}
exports.fetchZones = fetchZones;
/** Add skills to skyblock-constants. This has caching so it's fine to call many times */
async function addZones(addingZones) {
    await constants.addJSONConstants('zones.json', addingZones, 'zone');
}
exports.addZones = addZones;
/** Fetch all the known SkyBlock slayer names as an array of strings */
async function fetchSlayers() {
    return await constants.fetchJSONConstant('slayers.json');
}
exports.fetchSlayers = fetchSlayers;
/** Add skills to skyblock-constants. This has caching so it's fine to call many times */
async function addSlayers(addingSlayers) {
    await constants.addJSONConstants('slayers.json', addingSlayers, 'slayer');
}
exports.addSlayers = addSlayers;
/** Fetch all the known SkyBlock slayer names as an array of strings */
async function fetchMinions() {
    return await constants.fetchJSONConstant('minions.json');
}
exports.fetchMinions = fetchMinions;
/** Add skills to skyblock-constants. This has caching so it's fine to call many times */
async function addMinions(addingMinions) {
    await constants.addJSONConstants('minions.json', addingMinions, 'minion');
}
exports.addMinions = addMinions;
async function fetchConstantValues() {
    return await constants.fetchJSONConstant('values.json');
}
exports.fetchConstantValues = fetchConstantValues;
async function setConstantValues(newValues) {
    let file = await fetchFile('values.json');
    if (!file.path)
        return;
    let oldValues;
    try {
        oldValues = JSON.parse(file.content);
    }
    catch {
        // invalid json, set it as an empty array
        oldValues = {};
    }
    const updatedStats = { ...oldValues, ...newValues };
    // there's not actually any new stats, just return
    // TODO: optimize this? might be fine already though, idk
    if (JSON.stringify(updatedStats) === JSON.stringify(oldValues))
        return;
    const commitMessage = 'Update values';
    try {
        await editFile(file, commitMessage, JSON.stringify(updatedStats, null, 2));
    }
    catch { }
}
exports.setConstantValues = setConstantValues;
