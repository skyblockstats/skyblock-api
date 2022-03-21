export interface Bank {
	balance?: number
	history: BankHistoryItem[]
}

export interface BankHistoryItem {
	change: number
	total: number
	timestamp: number
	name: string
}

export function cleanBank(data: any): Bank {
	let history: BankHistoryItem[] = []

	if (data?.banking?.transactions) {
		let bankBalance = Math.round(data.banking.balance * 10) / 10
		// we go in reverse so we can simulate the bank transactions
		for (const transaction of data.banking.transactions.sort((a, b) => b.timestamp - a.timestamp)) {
			const change = transaction.action === 'DEPOSIT' ? transaction.amount : -transaction.amount
			// since we're going in reverse, we remove from the total balance when adding to the history
			bankBalance -= change
			history.push({
				change: Math.round(change * 10) / 10,
				total: Math.round(bankBalance * 10) / 10,
				timestamp: transaction.timestamp,
				name: transaction.initiator_name,
			})
		}
	}

	// history.reverse()

	return {
		balance: data?.banking?.balance ? Math.round(data.banking.balance * 10) / 10 : undefined,
		history
	}
}