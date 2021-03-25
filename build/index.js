"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.debug = void 0;
const hypixel_1 = require("./hypixel");
const express_1 = __importDefault(require("express"));
const database_1 = require("./database");
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const app = express_1.default();
exports.debug = false;
// 250 requests over 5 minutes
const limiter = express_rate_limit_1.default({
    windowMs: 60 * 1000 * 5,
    max: 250,
    skip: (req, res) => {
        return req.headers.key === process.env.key;
    }
});
app.use(limiter);
app.get('/', async (req, res) => {
    res.json({ ok: true });
});
app.get('/player/:user', async (req, res) => {
    res.json(await hypixel_1.fetchUser({ user: req.params.user }, ['profiles', 'player']));
});
app.get('/player/:user/:profile', async (req, res) => {
    res.json(await hypixel_1.fetchMemberProfile(req.params.user, req.params.profile));
});
app.get('/leaderboard/:name', async (req, res) => {
    res.json(await database_1.fetchMemberLeaderboard(req.params.name));
});
app.get('/leaderboards', async (req, res) => {
    res.json(await database_1.fetchAllLeaderboardsCategorized());
});
app.listen(8080, () => console.log('App started :)'));
