"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.debug = void 0;
const database_1 = require("./database");
const hypixel_1 = require("./hypixel");
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const express_1 = __importDefault(require("express"));
const app = express_1.default();
exports.debug = false;
// 200 requests over 5 minutes
const limiter = express_rate_limit_1.default({
    windowMs: 60 * 1000 * 5,
    max: 200,
    skip: (req) => {
        return req.headers.key === process.env.key;
    },
    keyGenerator: (req) => {
        var _a;
        return ((_a = req.headers['cf-connecting-ip']) !== null && _a !== void 0 ? _a : req.ip).toString();
    }
});
app.use(limiter);
app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    next();
});
app.get('/', async (req, res) => {
    res.json({ ok: true });
});
app.get('/player/:user', async (req, res) => {
    res.json(await hypixel_1.fetchUser({ user: req.params.user }, ['profiles', 'player']));
});
app.get('/player/:user/:profile', async (req, res) => {
    res.json(await hypixel_1.fetchMemberProfile(req.params.user, req.params.profile));
});
app.get('/player/:user/:profile/leaderboards', async (req, res) => {
    res.json(await database_1.fetchMemberLeaderboardSpots(req.params.user, req.params.profile));
});
app.get('/leaderboard/:name', async (req, res) => {
    try {
        res.json(await database_1.fetchLeaderboard(req.params.name));
    }
    catch (err) {
        console.error(err);
        res.json({ 'error': err.toString() });
    }
});
app.get('/leaderboards', async (req, res) => {
    res.json(await database_1.fetchAllLeaderboardsCategorized());
});
// only run the server if it's not doing tests
if (typeof global.it !== 'function')
    app.listen(8080, () => console.log('App started :)'));
