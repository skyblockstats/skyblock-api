import { createSession, fetchAccountFromDiscord, fetchAllLeaderboardsCategorized, fetchItemPriceData, fetchItemsByName, fetchLeaderboard, fetchMemberLeaderboardSpots, fetchMostSoldItems, fetchSession, finishedCachingRawLeaderboards, leaderboardUpdateMemberQueue, leaderboardUpdateProfileQueue, updateAccount } from './database.js';
import { fetchMemberProfile, fetchUser } from './hypixel.js';
import { fetchAllAuctions } from './hypixelCached.js';
import * as constants from './constants.js';
import rateLimit from 'express-rate-limit';
import * as discord from './discord.js';
import express from 'express';
import { basicPlayerCache, basicProfilesCache, playerCache, profileCache, profileNameCache, profilesCache, usernameCache } from './hypixelCached.js';
const app = express();
export const debug = true;
const mainSiteUrl = 'https://skyblock.matdoes.dev';
// 200 requests over 5 minutes
const limiter = rateLimit({
    windowMs: 60 * 1000 * 5,
    max: 200,
    skip: (req) => {
        return req.headers.key === process.env.key;
    },
    keyGenerator: (req) => {
        return (req.headers['cf-connecting-ip'] ?? req.ip).toString();
    }
});
app.use(limiter);
app.use(express.json());
app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    next();
});
const startTime = Date.now();
app.get('/', async (req, res) => {
    const currentTime = Date.now();
    res.json({
        ok: true,
        uptimeHours: (currentTime - startTime) / 1000 / 60 / 60,
        finishedCachingRawLeaderboards,
        leaderboardUpdateMemberQueueSize: leaderboardUpdateMemberQueue.size,
        leaderboardUpdateProfileQueueSize: leaderboardUpdateProfileQueue.size,
        usernameCacheSize: usernameCache.keys().length,
        basicProfilesCacheSize: basicProfilesCache.keys().length,
        playerCacheSize: playerCache.keys().length,
        basicPlayerCacheSize: basicPlayerCache.keys().length,
        profileCacheSize: profileCache.keys().length,
        profilesCacheSize: profilesCache.keys().length,
        profileNameCacheSize: profileNameCache.keys().length,
        // key: getKeyUsage()
    });
});
app.get('/player/:user', async (req, res) => {
    try {
        const user = await fetchUser({ user: req.params.user }, [req.query.basic === 'true' ? undefined : 'profiles', 'player'], req.query.customization === 'true');
        if (user)
            res.json(user);
        else
            res.status(404).json({ error: true });
    }
    catch (err) {
        console.error(err);
        res.json({ error: true });
    }
});
app.get('/discord/:id', async (req, res) => {
    try {
        res.json(await fetchAccountFromDiscord(req.params.id));
    }
    catch (err) {
        console.error(err);
        res.json({ ok: false });
    }
});
app.get('/player/:user/:profile', async (req, res) => {
    try {
        const profile = await fetchMemberProfile(req.params.user, req.params.profile, req.query.customization === 'true');
        if (profile)
            res.json(profile);
        else
            res.status(404).json({ error: true });
    }
    catch (err) {
        console.error(err);
        res.json({ error: true });
    }
});
app.get('/player/:user/:profile/leaderboards', async (req, res) => {
    try {
        res.json(await fetchMemberLeaderboardSpots(req.params.user, req.params.profile));
    }
    catch (err) {
        console.error(err);
        res.json({ ok: false });
    }
});
app.get('/leaderboard/:name', async (req, res) => {
    try {
        res.json(await fetchLeaderboard(req.params.name));
    }
    catch (err) {
        console.error(err);
        res.json({ 'error': err.toString() });
    }
});
app.get('/leaderboards', async (req, res) => {
    try {
        res.json(await fetchAllLeaderboardsCategorized());
    }
    catch (err) {
        console.error(err);
        res.json({ ok: false });
    }
});
app.get('/constants', async (req, res) => {
    try {
        res.json(await constants.fetchConstantValues());
    }
    catch (err) {
        console.error(err);
        res.json({ ok: false });
    }
});
app.get('/auctions', async (req, res) => {
    res.json(await fetchAllAuctions());
});
app.get('/auctions/price', async (req, res) => {
    /** just assume the params are perfectly accurate */
    const item = {
        id: req.query.id,
        tier: req.query.tier,
    };
    res.json(await fetchItemPriceData(item));
});
app.get('/auctions/search', async (req, res) => {
    /** just assume the params are perfectly accurate */
    if (!req.query.q)
        return res.json({ ok: false, error: 'no query' });
    const query = req.query.q;
    let itemName = query;
    let filters = {};
    for (let match of query.matchAll(/(\w+):([^ ]+)/g)) {
        const filterName = match[1];
        const filterValue = match[2];
        // if the filter is there more than once, add it with a comma
        if (filters[filterName])
            filters[filterName] += `,${filterValue}`;
        else
            filters[filterName] = filterValue;
        // remove the filter part from itemName
        itemName = itemName.replace(match[0], '');
    }
    itemName = itemName.trim().replace(/\s\s+/g, ' ');
    console.log(filters);
    let enchantments = {};
    // enchantments are in the format "enchantments:ultimate_bank1,cubism2"
    // also if the number at the end is omitted, match any level
    if (filters.enchantments) {
        const splitEnchantments = filters.enchantments.split(',');
        for (let enchantmentString of splitEnchantments) {
            console.log('enchantmentString', enchantmentString);
            const [_, enchantmentName, enchantmentLevelString] = enchantmentString.trim().match(/^([a-zA-Z_]+)(\d*)$/) ?? [];
            const enchantmentLevel = enchantmentLevelString ? parseInt(enchantmentLevelString) : null;
            enchantments[enchantmentName] = enchantmentLevel;
        }
    }
    console.log('enchantments', enchantments);
    const matchingItems = await fetchItemsByName(itemName, {});
    res.json(matchingItems);
});
app.get('/auctions/top', async (req, res) => {
    res.json(await fetchMostSoldItems());
});
app.post('/accounts/createsession', async (req, res) => {
    try {
        const { code } = req.body;
        const codeExchange = await discord.exchangeCode(`${mainSiteUrl}/loggedin`, code);
        if (!codeExchange) {
            res.json({ ok: false, error: 'discord_client_secret isn\'t in env' });
            return;
        }
        const { access_token: accessToken, refresh_token: refreshToken } = codeExchange;
        if (!accessToken)
            // access token is invalid :(
            return res.json({ ok: false });
        const userData = await discord.getUser(accessToken);
        const sessionId = await createSession(refreshToken, userData);
        res.json({ ok: true, session_id: sessionId });
    }
    catch (err) {
        res.json({ ok: false });
    }
});
app.post('/accounts/session', async (req, res) => {
    try {
        const { uuid } = req.body;
        const session = await fetchSession(uuid);
        if (!session)
            return res.json({ ok: false });
        const account = await fetchAccountFromDiscord(session.discord_user.id);
        res.json({ session, account });
    }
    catch (err) {
        console.error(err);
        res.json({ ok: false });
    }
});
app.post('/accounts/update', async (req, res) => {
    // it checks against the key, so it's kind of secure
    if (req.headers.key !== process.env.key)
        return console.log('bad key!');
    try {
        await updateAccount(req.body.discordId, req.body);
        res.json({ ok: true });
    }
    catch (err) {
        console.error(err);
        res.json({ ok: false });
    }
});
process.on('uncaughtException', err => console.error(err));
process.on('unhandledRejection', (err, promise) => console.error(promise, err));
// only run the server if it's not doing tests
if (!globalThis.isTest)
    app.listen(8080, () => console.log('App started :)'));
