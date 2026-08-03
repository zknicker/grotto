import * as React from 'react';
import { agentHtmlSandbox } from '../../agent-html/sandbox.ts';
import { agentHtmlTokenCss, injectHostTokenStyle } from '../../agent-html/tokens.ts';
import { useResolvedThemeOptional } from '../../components/theme-provider.tsx';
import { trpc } from '../../lib/trpc.tsx';
import starterHtml from './home-canvas-starter.html?raw';
import type { OverviewAgent } from './overview-types.ts';

// The home canvas (specs/home-brief.md): an agent-authored HTML page at
// workbench/home.html, maintained by the Home brief automation and rendered
// in the sandboxed artifact frame with the host token bridge. Any
// agent may own the file; the freshest copy across agents wins. When nobody
// has authored one yet, the shipped starter renders instead.
export const homeCanvasPath = 'workbench/home.html';

const defaultCanvasHeight = 200;
const minCanvasHeight = 120;
const maxCanvasHeight = 720;

/** Height contract: `<meta name="tavern-canvas-height" content="240">`. */
export function parseCanvasHeight(html: string): number {
    const match = /<meta\s+name="tavern-canvas-height"\s+content="(\d{2,4})"/iu.exec(html);

    if (!match?.[1]) {
        return defaultCanvasHeight;
    }

    const height = Number.parseInt(match[1], 10);

    return Math.min(maxCanvasHeight, Math.max(minCanvasHeight, height));
}

/**
 * Forgiving sprite keys for an avatar: the exact lowercased name, a hyphen
 * slug, and a bare alphanumeric collapse — so "Wren's Twin" matches
 * `wren's twin`, `wren-s-twin`, and `wrenstwin` alike. Selectors also take
 * the case-insensitive flag, so capitalization never matters.
 */
export function agentAvatarAliases(name: string): string[] {
    const exact = name.trim().toLowerCase().replaceAll(/\s+/gu, ' ');
    const slug = exact.replaceAll(/[^a-z0-9-]+/gu, '-');
    const collapsed = exact.replaceAll(/[^a-z0-9]+/gu, '');

    return [...new Set([exact, slug, collapsed])].filter((alias) => alias.length > 0);
}

/**
 * CSS the bridge injects so a generated page can seat real agent avatars:
 * `<span class="tavern-avatar" data-agent="otto"></span>`. All styling lives
 * on the matched selectors, so a span naming an unknown agent — or one whose
 * agent has no uploaded avatar — collapses to nothing instead of leaving an
 * empty gap.
 */
export function buildAvatarSpriteCss(sprites: { aliases: string[]; url: string }[]): string {
    const declarations =
        'display:inline-block;width:1.15em;height:1.15em;border-radius:30%;background-size:cover;background-repeat:no-repeat;background-position:center;vertical-align:-0.18em;';
    const rules = sprites.flatMap((sprite) => {
        const image = `background-image:url(${cssString(sprite.url)})`;

        return sprite.aliases.map(
            (alias) => `.tavern-avatar[data-agent=${cssString(alias)} i]{${declarations}${image}}`
        );
    });

    return rules.join('');
}

export function HomeCanvas({ agents }: { agents: OverviewAgent[] }) {
    // One bounded read per agent; the freshest authored copy wins.
    const fileQueries = trpc.useQueries((query) =>
        agents.map((agent) =>
            query.agent.workspaceReadableFile(
                { agentId: agent.id, path: homeCanvasPath },
                {
                    retry: false,
                }
            )
        )
    );
    const authored = fileQueries
        .map((result) => result.data)
        .filter(
            (file): file is NonNullable<typeof file> =>
                Boolean(file) && file?.mediaType === 'text/html' && !file.binary
        )
        .sort((a, b) => ((a.updatedAt ?? '') < (b.updatedAt ?? '') ? 1 : -1))[0];
    const html = authored?.content ?? starterHtml;

    return <HomeCanvasDocument agents={agents} html={html} />;
}

export function StarterHomeCanvas({ agents }: { agents: OverviewAgent[] }) {
    return <HomeCanvasDocument agents={agents} html={starterHtml} />;
}

function HomeCanvasDocument({ agents, html }: { agents: OverviewAgent[]; html: string }) {
    const scheme = useResolvedThemeOptional() === 'dark' ? 'dark' : 'light';
    // srcDoc must be final at mount: effect-time updates race the initial
    // frame navigation and drop silently.
    const srcDoc = React.useMemo(
        () =>
            injectHostTokenStyle(
                html,
                `${agentHtmlTokenCss(scheme)}${buildAvatarSpriteCss(toAvatarSprites(agents))}`
            ),
        [agents, html, scheme]
    );

    return (
        <iframe
            className="w-full"
            sandbox={agentHtmlSandbox}
            srcDoc={srcDoc}
            style={{ border: 0, colorScheme: scheme, height: parseCanvasHeight(html) }}
            title="Home"
        />
    );
}

function toAvatarSprites(agents: OverviewAgent[]) {
    return agents.flatMap((agent) =>
        agent.avatarUrl ? [{ aliases: agentAvatarAliases(agent.name), url: agent.avatarUrl }] : []
    );
}

function cssString(value: string): string {
    return `"${value.replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`;
}
