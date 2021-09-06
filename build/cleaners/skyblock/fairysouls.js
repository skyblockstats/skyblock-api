export function cleanFairySouls(data) {
    return {
        total: data?.fairy_souls_collected ?? 0,
        unexchanged: data?.fairy_souls ?? 0,
        exchanges: data?.fairy_exchanges ?? 0,
    };
}
