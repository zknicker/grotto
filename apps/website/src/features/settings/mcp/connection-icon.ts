import type { ResolvedTheme } from '../../../components/theme-provider.tsx';
import { getSenderCssVar } from '../../rows/sender-color.ts';
import type { McpConnection } from './mcp-server-shared.ts';

/**
 * How a connection row draws its mark.
 *
 * Grotto Server resolves and inlines the image at discovery, so this is a pure
 * pick with no fetching: an icon the server stored, otherwise a monogram tinted
 * from the shared sender palette so a server without one still reads as itself.
 */
export type ConnectionIcon =
    | { colorVar: string; kind: 'monogram'; letter: string }
    | { kind: 'image'; src: string };

export function connectionIcon(
    connection: Pick<McpConnection, 'icon' | 'id' | 'name'>,
    theme: ResolvedTheme
): ConnectionIcon {
    // An untagged upstream icon is stored in both slots, so the other variant
    // is a real fallback rather than a guess.
    const src = connection.icon
        ? (connection.icon[theme] ?? connection.icon[theme === 'dark' ? 'light' : 'dark'])
        : null;
    if (src) {
        return { kind: 'image', src };
    }
    return {
        colorVar: getSenderCssVar(connection.id),
        kind: 'monogram',
        letter: monogramLetter(connection.name),
    };
}

function monogramLetter(name: string): string {
    return [...name.trim()][0]?.toUpperCase() ?? '?';
}
