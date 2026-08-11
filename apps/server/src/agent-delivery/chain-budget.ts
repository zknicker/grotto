export const maxAgentChainTurns = 16;

interface AuthoredWork {
    source: string;
}

export function isAgentAuthored(row: AuthoredWork): boolean {
    return row.source.startsWith('agent:');
}

export function canBeginAgentDrain(rows: AuthoredWork[], currentTurns: number): boolean {
    return !isPureAgentDrain(rows) || currentTurns < maxAgentChainTurns;
}

export function nextAgentChainTurns(rows: AuthoredWork[], currentTurns: number): number {
    if (rows.length === 0) {
        return currentTurns;
    }
    return isPureAgentDrain(rows) ? currentTurns + 1 : 0;
}

function isPureAgentDrain(rows: AuthoredWork[]): boolean {
    return rows.length > 0 && rows.every(isAgentAuthored);
}
