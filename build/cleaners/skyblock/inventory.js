// maybe todo?: create a fast replacement for prismarine-nbt
import { extractItemTier } from '../../util.js';
import * as nbt from 'prismarine-nbt';
function base64decode(base64) {
    return Buffer.from(base64, 'base64');
}
function cleanItem(rawItem) {
    // if the item doesn't have an id, it isn't an item
    if (rawItem.id === undefined)
        return null;
    const vanillaId = rawItem.id;
    const itemCount = rawItem.Count;
    const damageValue = rawItem.Damage;
    const itemTag = rawItem.tag;
    const extraAttributes = itemTag?.ExtraAttributes ?? {};
    let headId;
    if (vanillaId === 397) {
        const headDataBase64 = itemTag?.SkullOwner?.Properties?.textures?.[0]?.Value;
        if (headDataBase64) {
            const headData = JSON.parse(base64decode(headDataBase64).toString());
            const headDataUrl = headData?.textures?.SKIN?.url;
            if (headDataUrl) {
                const splitUrl = headDataUrl.split('/');
                headId = splitUrl[splitUrl.length - 1];
            }
        }
    }
    // '{"type":"FLYING_FISH","active":false,"exp":1021029.881446,"tier":"LEGENDARY","hideInfo":false,"candyUsed":1}'
    const petInfo = extraAttributes.petInfo ? JSON.parse(extraAttributes.petInfo) : {};
    return {
        id: extraAttributes.id ?? null,
        count: itemCount ?? 1,
        vanillaId: damageValue ? `${vanillaId}:${damageValue}` : vanillaId.toString(),
        display: {
            name: itemTag?.display?.Name ?? 'null',
            lore: itemTag?.display?.Lore ?? [],
            // if it has an ench value in the tag, then it should have an enchant glint effect
            glint: (itemTag?.ench ?? []).length > 0
        },
        reforge: extraAttributes.modifier ?? undefined,
        enchantments: extraAttributes.enchantments,
        anvil_uses: extraAttributes.anvil_uses,
        // TODO: parse this to be a number, hypixel returns it in this format: 6/24/21 9:32 AM
        timestamp: extraAttributes.timestamp,
        origin_tag: extraAttributes.originTag,
        pet_type: petInfo.type ?? undefined,
        potion_type: extraAttributes.potion ?? undefined,
        potion_level: extraAttributes.potion_level ?? undefined,
        potion_effectiveness_level: extraAttributes.enhanced ?? undefined,
        potion_duration_level: extraAttributes.extended ?? undefined,
        head_texture: headId,
        tier: extractItemTier(itemTag?.display?.Lore ?? [])
    };
}
function cleanItems(rawItems) {
    return rawItems.map(cleanItem);
}
export function cleanItemEncoded(encodedNbt) {
    return new Promise(async (resolve) => {
        const base64Data = base64decode(encodedNbt);
        const value = await nbt.parse(base64Data);
        const simplifiedNbt = nbt.simplify(value.parsed);
        resolve(cleanItem(simplifiedNbt.i[0]));
    });
}
export function cleanInventory(encodedNbt) {
    return new Promise(resolve => {
        const base64Data = base64decode(encodedNbt);
        nbt.parse(base64Data, false, (err, value) => {
            const simplifiedNbt = nbt.simplify(value);
            // do some cleaning on the items and return
            resolve(cleanItems(simplifiedNbt.i));
        });
    });
}
export const INVENTORIES = {
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
export async function cleanInventories(data) {
    const cleanInventories = {};
    for (const cleanInventoryName in INVENTORIES) {
        const hypixelInventoryName = INVENTORIES[cleanInventoryName];
        const encodedInventoryContents = data[hypixelInventoryName]?.data;
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
