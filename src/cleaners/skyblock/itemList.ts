import typedHypixelApi from 'typed-hypixel-api'
import { headIdFromBase64 } from './inventory.js'
import { cleanItemId } from './itemId.js'

export interface ItemRequirement {
    dungeon?: {
        type: string
        level: number
    }
    skill?: {
        type: string
        level: number
    }
    slayer?: {
        boss: string
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
    requirements: ItemRequirement
    category: string | null
    soulbound: boolean
    museum: boolean
}

export interface ItemListData {
    lastUpdated: number
    list: ItemListItem[]
}

function cleanItemRequirements(data: typedHypixelApi.SkyBlockItemsResponse['items'][number]['requirements'], catacombsRequirements: typedHypixelApi.SkyBlockItemsResponse['items'][number]['catacombs_requirements']): ItemRequirement {
    if (!data) return {}
    let dungeonData = data.dungeon ?? catacombsRequirements?.dungeon
    return {
        dungeon: dungeonData ? {
            type: dungeonData.type.toLowerCase(),
            level: dungeonData.level
        } : undefined,
        skill: data.skill ? {
            type: data.skill.type.toLowerCase(),
            level: data.skill.level
        } : undefined,
        slayer: data.slayer ? {
            boss: data.slayer.slayer_boss_type,
            level: data.slayer.level
        } : undefined
    }
}

function cleanItemListItem(item: typedHypixelApi.SkyBlockItemsResponse['items'][number]): ItemListItem {
    const vanillaId = cleanItemId(item.durability ? `${item.material}:${item.durability}` : item.material)
    return {
        id: item.id,
        headTexture: (item.material === 'SKULL_ITEM' && 'skin' in item) ? headIdFromBase64(item.skin) : undefined,
        vanillaId,
        tier: item.tier ?? null,
        display: {
            name: item.name,
            glint: item.glowing ?? false
        },
        npcSellPrice: item.npc_sell_price ?? null,
        requirements: cleanItemRequirements(item.requirements, item.catacombs_requirements),
        category: item.category?.toLowerCase() ?? null,
        soulbound: !!item.soulbound,
        museum: item.museum ?? false
    }
}

export async function cleanItemListResponse(data: typedHypixelApi.SkyBlockItemsResponse): Promise<ItemListData> {
    return {
        lastUpdated: data.lastUpdated,
        list: data.items.map(cleanItemListItem)
    }
}