export function formatTokens(value: number) {
    return new Intl.NumberFormat(undefined, {
        maximumFractionDigits: value >= 10_000 ? 1 : 0,
        notation: value >= 10_000 ? 'compact' : 'standard',
    }).format(value);
}

export function formatPercent(value: number) {
    return `${value.toFixed(1)}%`;
}
