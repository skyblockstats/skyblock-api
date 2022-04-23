import typedHypixelApi from 'typed-hypixel-api'

export interface ItemRequirement {
    // idk what these do
    // they'll probably be renamed at some point
    dungeon: {
        type: string
        level: number
    }
}

// based on Item from inventory.ts
export interface ItemListItem {
    id: string
    headTexture?: string
    vanillaId: string
    tier: string | null
    display: {
        name: string
        glint: boolean
    }
    npcSellPrice: number | null
    requirements: ItemRequirement | null
}

export interface ItemListData {
    lastUpdated: number
    list: ItemListItem[]
}

function cleanItemRequirements(data: typedHypixelApi.SkyBlockItemsResponse['items'][number]['requirements'] & typedHypixelApi.SkyBlockItemsResponse['items'][number]['catacombs_requirements']): ItemRequirement | null {
    if (!data || !data.dungeon) return null
    return {
        dungeon: {
            type: data.dungeon.type,
            level: data.dungeon.level
        }
    }
}

function cleanItemListItem(item: typedHypixelApi.SkyBlockItemsResponse['items'][number]): ItemListItem {
    const vanillaId = item.material.toLowerCase()
    return {
        id: item.id,
        headTexture: (item.material === 'SKULL_ITEM' && 'skin' in item) ? item.skin : undefined,
        vanillaId: item.durability ? `${vanillaId}:${item.durability}` : vanillaId,
        tier: item.tier ?? null,
        display: {
            name: item.name,
            glint: item.glowing ?? false
        },
        npcSellPrice: item.npc_sell_price ?? null,
        requirements: cleanItemRequirements(item.catacombs_requirements ?? item.requirements)
    }
}

export async function cleanItemListResponse(data: typedHypixelApi.SkyBlockItemsResponse): Promise<ItemListData> {
    return {
        lastUpdated: data.lastUpdated,
        list: data.items.map(cleanItemListItem)
    }
}