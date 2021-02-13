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
Object.defineProperty(exports, "__esModule", { value: true });
exports.cleanInventories = exports.INVENTORIES = exports.cleanInventory = void 0;
const nbt = __importStar(require("prismarine-nbt"));
function base64decode(base64) {
    return Buffer.from(base64, 'base64');
}
function cleanInventory(encodedNbt) {
    return new Promise(resolve => {
        const base64Data = base64decode(encodedNbt);
        nbt.parse(base64Data, false, (err, value) => {
            const simplifiedNbt = nbt.simplify(value);
            // .i because hypixel decided to do that
            resolve(simplifiedNbt.i);
        });
    });
}
exports.cleanInventory = cleanInventory;
exports.INVENTORIES = {
    armor: 'inv_armor',
    inventory: 'inv_contents',
    ender_chest: 'ender_chest_contents',
    talisman_bag: 'talisman_bag',
    potion_bag: 'potion_bag',
    fishing_bag: 'fishing_bag',
    quiver: 'quiver',
    trick_or_treat_bag: 'candy_inventory_contents',
    wardrobe: 'wardrobe_contents'
};
async function cleanInventories(data) {
    var _a;
    const cleanInventories = {};
    for (const cleanInventoryName in exports.INVENTORIES) {
        const hypixelInventoryName = exports.INVENTORIES[cleanInventoryName];
        const encodedInventoryContents = (_a = data[hypixelInventoryName]) === null || _a === void 0 ? void 0 : _a.data;
        let inventoryContents;
        if (encodedInventoryContents)
            inventoryContents = await cleanInventory(encodedInventoryContents);
        cleanInventories[cleanInventoryName] = inventoryContents;
    }
    return cleanInventories;
}
exports.cleanInventories = cleanInventories;
