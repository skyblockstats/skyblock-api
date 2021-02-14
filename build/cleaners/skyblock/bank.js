"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cleanBank = void 0;
function cleanBank(data) {
    var _a, _b;
    return {
        balance: (_b = (_a = data === null || data === void 0 ? void 0 : data.banking) === null || _a === void 0 ? void 0 : _a.balance) !== null && _b !== void 0 ? _b : 0,
        // TODO: make transactions good
        // history: data?.banking?.transactions ?? []
        history: []
    };
}
exports.cleanBank = cleanBank;
