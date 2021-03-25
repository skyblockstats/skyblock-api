"use strict";
/**
 * Fetch the Mojang username API through api.ashcon.app
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.profileFromUser = exports.profileFromUsername = exports.profileFromUuid = void 0;
const node_fetch_1 = __importDefault(require("node-fetch"));
const https_1 = require("https");
const util_1 = require("./util");
// We need to create an agent to prevent memory leaks
const httpsAgent = new https_1.Agent({
    keepAlive: true
});
/**
 * Get mojang api data from the session server
 */
async function profileFromUuid(uuid) {
    const fetchResponse = await node_fetch_1.default(
    // using mojang directly is faster than ashcon lol, also mojang removed the ratelimits from here
    `https://sessionserver.mojang.com/session/minecraft/profile/${util_1.undashUuid(uuid)}`, { agent: () => httpsAgent });
    let data;
    try {
        data = await fetchResponse.json();
    }
    catch {
        // if it errors, just return null
        return { uuid: null, username: null };
    }
    return {
        uuid: data.id,
        username: data.name
    };
}
exports.profileFromUuid = profileFromUuid;
async function profileFromUsername(username) {
    // since we don't care about anything other than the uuid, we can use /uuid/ instead of /user/
    const fetchResponse = await node_fetch_1.default(`https://api.mojang.com/users/profiles/minecraft/${username}`, { agent: () => httpsAgent });
    let data;
    try {
        data = await fetchResponse.json();
    }
    catch {
        return { uuid: null, username: null };
    }
    return {
        uuid: data.id,
        username: data.name
    };
}
exports.profileFromUsername = profileFromUsername;
async function profileFromUser(user) {
    if (util_1.isUuid(user)) {
        return await profileFromUuid(user);
    }
    else
        return await profileFromUsername(user);
}
exports.profileFromUser = profileFromUser;
