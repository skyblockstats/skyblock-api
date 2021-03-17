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
exports.cleanInventories = exports.INVENTORIES = exports.cleanInventory = exports.cleanItemEncoded = void 0;
const nbt = __importStar(require("prismarine-nbt"));
function base64decode(base64) {
    return Buffer.from(base64, 'base64');
}
function cleanItem(rawItem) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m;
    // if the item doesn't have an id, it isn't an item
    if (rawItem.id === undefined)
        return null;
    const vanillaId = rawItem.id;
    const itemCount = rawItem.Count;
    const damageValue = rawItem.Damage;
    const itemTag = rawItem.tag;
    const extraAttributes = (_a = itemTag === null || itemTag === void 0 ? void 0 : itemTag.ExtraAttributes) !== null && _a !== void 0 ? _a : {};
    return {
        id: (_b = extraAttributes === null || extraAttributes === void 0 ? void 0 : extraAttributes.id) !== null && _b !== void 0 ? _b : null,
        count: itemCount !== null && itemCount !== void 0 ? itemCount : 1,
        vanillaId: damageValue ? `${vanillaId}:${damageValue}` : vanillaId.toString(),
        display: {
            name: (_d = (_c = itemTag === null || itemTag === void 0 ? void 0 : itemTag.display) === null || _c === void 0 ? void 0 : _c.Name) !== null && _d !== void 0 ? _d : 'null',
            lore: (_f = (_e = itemTag === null || itemTag === void 0 ? void 0 : itemTag.display) === null || _e === void 0 ? void 0 : _e.Lore) !== null && _f !== void 0 ? _f : [],
            // if it has an ench value in the tag, then it should have an enchant glint effect
            glint: ((_g = itemTag === null || itemTag === void 0 ? void 0 : itemTag.ench) !== null && _g !== void 0 ? _g : []).length > 0
        },
        reforge: extraAttributes === null || extraAttributes === void 0 ? void 0 : extraAttributes.modifier,
        enchantments: extraAttributes === null || extraAttributes === void 0 ? void 0 : extraAttributes.enchantments,
        anvil_uses: extraAttributes === null || extraAttributes === void 0 ? void 0 : extraAttributes.anvil_uses,
        timestamp: extraAttributes === null || extraAttributes === void 0 ? void 0 : extraAttributes.timestamp,
        skull_owner: (_m = (_l = (_k = (_j = (_h = itemTag === null || itemTag === void 0 ? void 0 : itemTag.SkullOwner) === null || _h === void 0 ? void 0 : _h.Properties) === null || _j === void 0 ? void 0 : _j.textures) === null || _k === void 0 ? void 0 : _k[0]) === null || _l === void 0 ? void 0 : _l.value) !== null && _m !== void 0 ? _m : undefined,
    };
}
function cleanItems(rawItems) {
    return rawItems.map(cleanItem);
}
function cleanItemEncoded(encodedNbt) {
    return new Promise(resolve => {
        const base64Data = base64decode(encodedNbt);
        nbt.parse(base64Data, false, (err, value) => {
            const simplifiedNbt = nbt.simplify(value);
            resolve(cleanItem(simplifiedNbt.i[0]));
        });
    });
}
exports.cleanItemEncoded = cleanItemEncoded;
function cleanInventory(encodedNbt) {
    return new Promise(resolve => {
        const base64Data = base64decode(encodedNbt);
        nbt.parse(base64Data, false, (err, value) => {
            const simplifiedNbt = nbt.simplify(value);
            // do some cleaning on the items and return
            resolve(cleanItems(simplifiedNbt.i));
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
        if (encodedInventoryContents) {
            inventoryContents = await cleanInventory(encodedInventoryContents);
            if (cleanInventoryName === 'armor')
                // the armor is sent from boots to head, the opposite makes more sense
                inventoryContents.reverse();
            cleanInventories[cleanInventoryName] = inventoryContents;
        }
    }
    return cleanInventories;
}
exports.cleanInventories = cleanInventories;
