# SkyBlock API

Backend for [skyblock.matdoes.dev](https://github.com/skyblockstats/skyblock-stats).

Basically this is [Slothpixel](https://github.com/slothpixel/core) but more specialized.

## What it does

1) A request is sent to the Express server in index.js
2) The express server then calls a function in hypixelCached depending on the request
3) hypixelCached will either directly return already-cached data, or continue to hypixel.ts
4) hypixel.ts will call hypixelApi to get the raw data from the Hypixel API
5) hypixel.ts calls one or more of the cleaners, which pretties up the data for us to use
6) cleaned data is returned to hypixelCached, which will cache it
7) Data is sent back to express to serve to the user
