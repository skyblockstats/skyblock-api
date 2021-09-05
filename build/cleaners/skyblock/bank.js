export function cleanBank(data) {
    return {
        balance: data?.banking?.balance ?? 0,
        // TODO: make transactions good
        // history: data?.banking?.transactions ?? []
        history: []
    };
}
