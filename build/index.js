"use strict";
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
exports.debug = void 0;
const database_1 = require("./database");
const hypixel_1 = require("./hypixel");
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const constants = __importStar(require("./constants"));
const express_1 = __importDefault(require("express"));
const app = express_1.default();
exports.debug = true;
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
    res.json(await hypixel_1.fetchUser({ user: req.params.user }, [req.query.basic === 'true' ? undefined : 'profiles', 'player']));
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
app.get('/constants', async (req, res) => {
    res.json(await constants.fetchConstantValues());
});
// only run the server if it's not doing tests
if (!globalThis.isTest)
    app.listen(8080, () => console.log('App started :)'));
