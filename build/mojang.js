"use strict";
/**
 * Fetch the Mojang username API through api.ashcon.app
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.usernameFromUser = exports.mojangDataFromUser = exports.uuidFromUser = exports.usernameFromUuid = exports.uuidFromUsername = exports.mojangDataFromUuid = void 0;
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
async function mojangDataFromUuid(uuid) {
    console.log('mojangDataFromUuid', uuid);
    const fetchResponse = await node_fetch_1.default(
    // using mojang directly is faster than ashcon lol, also mojang removed the ratelimits from here
    `https://sessionserver.mojang.com/session/minecraft/profile/${util_1.undashUuid(uuid)}`, { agent: () => httpsAgent });
    const data = await fetchResponse.json();
    return {
        uuid: data.id,
        username: data.name
    };
}
exports.mojangDataFromUuid = mojangDataFromUuid;
async function uuidFromUsername(username) {
    console.log('uuidFromUsername', username);
    // since we don't care about anything other than the uuid, we can use /uuid/ instead of /user/
    const fetchResponse = await node_fetch_1.default(`https://api.ashcon.app/mojang/v2/uuid/${username}`, { agent: () => httpsAgent });
    const userUuid = await fetchResponse.text();
    return userUuid.replace(/-/g, '');
}
exports.uuidFromUsername = uuidFromUsername;
async function usernameFromUuid(uuid) {
    const userJson = await mojangDataFromUuid(uuid);
    return userJson.username;
}
exports.usernameFromUuid = usernameFromUuid;
/**
 * Fetch the uuid from a user
 * @param user A user can be either a uuid or a username
 */
async function uuidFromUser(user) {
    if (util_1.isUuid(user))
        // already a uuid, just return it undashed
        return util_1.undashUuid(user);
    else
        return await uuidFromUsername(user);
}
exports.uuidFromUser = uuidFromUser;
async function mojangDataFromUser(user) {
    if (!util_1.isUuid(user))
        return await mojangDataFromUuid(await uuidFromUsername(user));
    else
        return await mojangDataFromUuid(user);
}
exports.mojangDataFromUser = mojangDataFromUser;
/**
 * Fetch the username from a user
 * @param user A user can be either a uuid or a username
 */
async function usernameFromUser(user) {
    // we do this to fix the capitalization
    const data = await mojangDataFromUser(user);
    return data.username;
}
exports.usernameFromUser = usernameFromUser;
