import * as React from 'react';
import { useResolvedThemeOptional } from '../../components/theme-provider.tsx';
import { trpc } from '../../lib/trpc.tsx';
import { workspaceIframeSandbox } from '../../widgets/sandbox.ts';
import { resolveAgentInk } from '../agents/agent-color-presets.ts';
import { AgentFace } from '../chats/agent-face.tsx';
import {
    injectHostTokenStyle,
    readHostFontFaceCss,
    readHostTokenCss,
} from '../chats/host-token-style.ts';
import starterHtml from './home-canvas-starter.html?raw';
import type { OverviewAgent } from './overview-types.ts';

// The home canvas (specs/home-brief.md): an agent-authored HTML page at
// workbench/home.html, maintained by the Home brief automation and rendered
// in the sandboxed artifact frame with the host token and font bridge. Any
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
 * Forgiving sprite keys for a face: the exact lowercased name, a hyphen
 * slug, and a bare alphanumeric collapse — so "Wren's Twin" matches
 * `wren's twin`, `wren-s-twin`, and `wrenstwin` alike. Selectors also take
 * the case-insensitive flag, so capitalization never matters.
 */
export function agentFaceAliases(name: string): string[] {
    const exact = name.trim().toLowerCase().replaceAll(/\s+/gu, ' ');
    const slug = exact.replaceAll(/[^a-z0-9-]+/gu, '-');
    const collapsed = exact.replaceAll(/[^a-z0-9]+/gu, '');

    return [...new Set([exact, slug, collapsed])].filter((alias) => alias.length > 0);
}

function cssAttributeString(value: string): string {
    return `"${value.replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`;
}

/**
 * CSS the bridge injects so a generated page can seat real doodle faces:
 * `<span class="tavern-face" data-agent="otto"></span>`. Sprites are the
 * live AgentFace render serialized to data URIs, so the roster's current
 * characters, colors, and theme ink always win over generation-time state.
 * All styling lives on the matched selectors, so a span naming an unknown
 * agent collapses to nothing instead of leaving an empty gap.
 */
export function buildFaceSpriteCss(sprites: { aliases: string[]; svg: string }[]): string {
    const declarations =
        'display:inline-block;width:1.15em;height:1.15em;background-size:contain;background-repeat:no-repeat;background-position:center;vertical-align:-0.18em;';
    const rules = sprites.flatMap((sprite) => {
        const image = `background-image:url("data:image/svg+xml,${encodeURIComponent(sprite.svg)}")`;

        return sprite.aliases.map(
            (alias) =>
                `.tavern-face[data-agent=${cssAttributeString(alias)} i]{${declarations}${image}}`
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
    const dark = scheme === 'dark';

    // Face sprites come from the hidden roster mount below: AgentFace sets
    // its pose in effects, so the snapshot must read the live DOM. Children's
    // effects run before this one within the same commit.
    const [faceCss, setFaceCss] = React.useState<string | null>(null);
    const spritesRef = React.useRef<HTMLDivElement>(null);
    // biome-ignore lint/correctness/useExhaustiveDependencies: the effect snapshots child DOM that is rendered from these inputs
    React.useEffect(() => {
        const container = spritesRef.current;

        if (!container) {
            setFaceCss('');
            return;
        }

        // XMLSerializer (not outerHTML) so the markup carries the SVG
        // namespace a standalone data-URI image requires.
        const serializer = new XMLSerializer();
        const sprites = [...container.querySelectorAll('[data-face-name]')].flatMap((holder) => {
            const svg = holder.querySelector('svg');
            const name = holder.getAttribute('data-face-name');

            return svg && name
                ? [{ aliases: agentFaceAliases(name), svg: serializer.serializeToString(svg) }]
                : [];
        });
        setFaceCss(buildFaceSpriteCss(sprites));
    }, [agents, scheme]);

    const srcDoc = React.useMemo(
        () =>
            injectHostTokenStyle(
                html,
                `${readHostTokenCss(scheme)}${readHostFontFaceCss()}${faceCss ?? ''}`
            ),
        [html, scheme, faceCss]
    );
    const height = parseCanvasHeight(html);

    return (
        <>
            <div
                aria-hidden="true"
                className="pointer-events-none fixed top-0 left-[-9999px] opacity-0"
                ref={spritesRef}
            >
                {agents.map((agent) => (
                    <div data-face-name={agent.name} key={agent.id}>
                        <AgentFace
                            animate={false}
                            dark={dark}
                            head={agent.effectiveCharacter}
                            ink={resolveAgentInk(dark, agent.effectivePrimaryColor)}
                            size={64}
                        />
                    </div>
                ))}
            </div>

            {/* Mount the frame only once sprites are snapshotted: srcDoc must
                be stable at mount (effect-time updates race the initial
                navigation and drop silently). */}
            {faceCss === null ? null : (
                <iframe
                    className="w-full"
                    sandbox={workspaceIframeSandbox}
                    srcDoc={srcDoc}
                    style={{ border: 0, colorScheme: scheme, height }}
                    title="Home"
                />
            )}
        </>
    );
}
