import typedHypixelApi from 'typed-hypixel-api'

export interface AccessoryBagUpgrades {
	tuningTemplates: Record<string, number>[]
	upgrades: {
		purchased: number
		coinsSpent: number
		extraSlots: number
	}
	powers: {
		selected: string | null
		list: string[]
	}
}

export function cleanAccessoryBagUpgrades(data: typedHypixelApi.SkyBlockProfileMember): AccessoryBagUpgrades {
	const tuningTemplates: Record<string, number>[] = []
	if (data.accessory_bag_storage)
		for (const [key, template] of Object.entries(data.accessory_bag_storage?.tuning)) {
			if (key.startsWith('slot_'))
				tuningTemplates.push(template as Record<string, number>)
		}

	let upgradesPurchased = data.accessory_bag_storage?.bag_upgrades_purchased ?? 0
	let upgradesCoinsSpent = 0
	let upgradesExtraSlots = upgradesPurchased * 2
	for (let i = 1; i <= upgradesPurchased; i++) {
		if (i == 1)
			upgradesCoinsSpent += 1_500_000
		else if (i <= 5)
			upgradesCoinsSpent += 5_000_000
		else if (i <= 10)
			upgradesCoinsSpent += 8_000_000
		else if (i <= 20)
			upgradesCoinsSpent += 12_000_000
		else
			upgradesCoinsSpent += 20_000_000
	}

	return {
		tuningTemplates,
		upgrades: {
			purchased: upgradesPurchased,
			coinsSpent: upgradesCoinsSpent,
			extraSlots: upgradesExtraSlots
		},
		powers: {
			selected: data.accessory_bag_storage?.selected_power ?? null,
			list: data.accessory_bag_storage?.unlocked_powers ?? []
		}
	}
}
