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
// maybe todo?: create a fast replacement for prismarine-nbt
const nbt = __importStar(require("prismarine-nbt"));
function base64decode(base64) {
    return Buffer.from(base64, 'base64');
}
function cleanItem(rawItem) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u;
    // if the item doesn't have an id, it isn't an item
    if (rawItem.id === undefined)
        return null;
    const vanillaId = rawItem.id;
    const itemCount = rawItem.Count;
    const damageValue = rawItem.Damage;
    const itemTag = rawItem.tag;
    const extraAttributes = (_a = itemTag === null || itemTag === void 0 ? void 0 : itemTag.ExtraAttributes) !== null && _a !== void 0 ? _a : {};
    let headId;
    if (vanillaId === 397) {
        const headDataBase64 = (_e = (_d = (_c = (_b = itemTag === null || itemTag === void 0 ? void 0 : itemTag.SkullOwner) === null || _b === void 0 ? void 0 : _b.Properties) === null || _c === void 0 ? void 0 : _c.textures) === null || _d === void 0 ? void 0 : _d[0]) === null || _e === void 0 ? void 0 : _e.Value;
        if (headDataBase64) {
            const headData = JSON.parse(base64decode(headDataBase64).toString());
            const headDataUrl = (_g = (_f = headData === null || headData === void 0 ? void 0 : headData.textures) === null || _f === void 0 ? void 0 : _f.SKIN) === null || _g === void 0 ? void 0 : _g.url;
            if (headDataUrl) {
                const splitUrl = headDataUrl.split('/');
                headId = splitUrl[splitUrl.length - 1];
            }
        }
    }
    // '{"type":"FLYING_FISH","active":false,"exp":1021029.881446,"tier":"LEGENDARY","hideInfo":false,"candyUsed":1}'
    const petInfo = extraAttributes.petInfo ? JSON.parse(extraAttributes.petInfo) : {};
    return {
        id: (_h = extraAttributes.id) !== null && _h !== void 0 ? _h : null,
        count: itemCount !== null && itemCount !== void 0 ? itemCount : 1,
        vanillaId: damageValue ? `${vanillaId}:${damageValue}` : vanillaId.toString(),
        display: {
            name: (_k = (_j = itemTag === null || itemTag === void 0 ? void 0 : itemTag.display) === null || _j === void 0 ? void 0 : _j.Name) !== null && _k !== void 0 ? _k : 'null',
            lore: (_m = (_l = itemTag === null || itemTag === void 0 ? void 0 : itemTag.display) === null || _l === void 0 ? void 0 : _l.Lore) !== null && _m !== void 0 ? _m : [],
            // if it has an ench value in the tag, then it should have an enchant glint effect
            glint: ((_o = itemTag === null || itemTag === void 0 ? void 0 : itemTag.ench) !== null && _o !== void 0 ? _o : []).length > 0
        },
        reforge: (_p = extraAttributes.modifier) !== null && _p !== void 0 ? _p : undefined,
        enchantments: extraAttributes.enchantments,
        anvil_uses: extraAttributes.anvil_uses,
        // TODO: parse this to be a number, hypixel returns it in this format: 6/24/21 9:32 AM
        timestamp: extraAttributes.timestamp,
        origin_tag: extraAttributes.originTag,
        pet_type: (_q = petInfo.type) !== null && _q !== void 0 ? _q : undefined,
        potion_type: (_r = extraAttributes.potion) !== null && _r !== void 0 ? _r : undefined,
        potion_level: (_s = extraAttributes.potion_level) !== null && _s !== void 0 ? _s : undefined,
        potion_effectiveness_level: (_t = extraAttributes.enhanced) !== null && _t !== void 0 ? _t : undefined,
        potion_duration_level: (_u = extraAttributes.extended) !== null && _u !== void 0 ? _u : undefined,
        head_texture: headId,
    };
}
function cleanItems(rawItems) {
    return rawItems.map(cleanItem);
}
function cleanItemEncoded(encodedNbt) {
    return new Promise(async (resolve) => {
        const base64Data = base64decode(encodedNbt);
        const value = await nbt.parse(base64Data);
        const simplifiedNbt = nbt.simplify(value.parsed);
        resolve(cleanItem(simplifiedNbt.i[0]));
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
