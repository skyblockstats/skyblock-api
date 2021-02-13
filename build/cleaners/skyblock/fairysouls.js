"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cleanFairySouls = void 0;
function cleanFairySouls(data) {
    var _a, _b, _c;
    return {
        total: (_a = data === null || data === void 0 ? void 0 : data.fairy_souls_collected) !== null && _a !== void 0 ? _a : 0,
        unexchanged: (_b = data === null || data === void 0 ? void 0 : data.fairy_souls) !== null && _b !== void 0 ? _b : 0,
        exchanges: (_c = data === null || data === void 0 ? void 0 : data.fairy_exchanges) !== null && _c !== void 0 ? _c : 0,
    };
}
exports.cleanFairySouls = cleanFairySouls;
