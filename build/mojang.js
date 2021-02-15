"use strict";
/**
 * Fetch the Mojang username API through api.ashcon.app
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.usernameFromUser = exports.uuidFromUser = exports.mojangDataFromUser = void 0;
const node_fetch_1 = __importDefault(require("node-fetch"));
const https_1 = require("https");
// We need to create an agent to prevent memory leaks
const httpsAgent = new https_1.Agent({
    keepAlive: true
});
/**
 * Get mojang api data from ashcon.app
 */
async function mojangDataFromUser(user) {
    const fetchResponse = await node_fetch_1.default('https://api.ashcon.app/mojang/v2/user/' + user, { agent: () => httpsAgent });
    return await fetchResponse.json();
}
exports.mojangDataFromUser = mojangDataFromUser;
/**
 * Fetch the uuid from a user
 * @param user A user can be either a uuid or a username
 */
async function uuidFromUser(user) {
    const fetchJSON = await mojangDataFromUser(user);
    return fetchJSON.uuid.replace(/-/g, '');
}
exports.uuidFromUser = uuidFromUser;
/**
 * Fetch the username from a user
 * @param user A user can be either a uuid or a username
 */
async function usernameFromUser(user) {
    // get a minecraft uuid from a username, using ashcon.app's mojang api
    const fetchJSON = await mojangDataFromUser(user);
    return fetchJSON.username;
}
exports.usernameFromUser = usernameFromUser;
