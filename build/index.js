"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.debug = void 0;
const hypixel_1 = require("./hypixel");
const express_1 = __importDefault(require("express"));
const app = express_1.default();
exports.debug = false;
app.use((req, res, next) => {
    if (process.env.key && req.headers.key !== process.env.key)
        // if a key is set in process.env and the header doesn't match return an error
        // TODO: make this have a status code
        return res.json({ error: 'Key in header must match key in env' });
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
app.listen(8080, () => console.log('App started :)'));
