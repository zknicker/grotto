import * as React from 'react';
import { cn } from '../lib/utils.ts';
import { visualColorScheme, visualTokenDeclarations } from './visual-tokens.ts';

/**
 * Generative visual: model-authored HTML rendered in a sandboxed iframe.
 * Containment mirrors the html-preview posture — opaque origin, srcDoc,
 * scripts allowed, never allow-same-origin — plus a CSP that pins the only
 * allowed external source to the Chart.js CDN entry below. Treat the body as
 * attacker-controlled; nothing from the fence may reach the app origin.
 */
const visualSandbox = 'allow-forms allow-modals allow-pointer-lock allow-popups allow-scripts';

/**
 * The one allowed external script, pinned by version. Bumping the pin is a
 * deliberate supply-chain decision: update the skill guidance and this CSP
 * together (docs/internals/widgets.md).
 */
export const visualChartJsUrl = 'https://cdn.jsdelivr.net/npm/chart.js@4.5.1/dist/chart.umd.min.js';

const visualCsp = [
    "default-src 'none'",
    `script-src 'unsafe-inline' https://cdn.jsdelivr.net/npm/chart.js@4.5.1/`,
    "style-src 'unsafe-inline'",
    'img-src data: blob:',
    'font-src data:',
    "connect-src 'none'",
    "form-action 'none'",
    "base-uri 'none'",
].join('; ');

export const visualHeights = {
    collapsed: 420,
    fallback: 240,
    max: 1600,
    min: 120,
} as const;

// While a visual is still streaming, srcdoc rewrites are throttled so the
// browser reparses at a readable cadence instead of per delta.
const streamingRedrawMs = 300;

export function VisualCard({
    html,
    open = false,
    title,
}: {
    html: string;
    open?: boolean;
    title?: string;
}) {
    const displayHtml = useThrottledValue(html, open ? streamingRedrawMs : 0);
    const tokensCss = useVisualTokens();
    const frameRef = React.useRef<HTMLIFrameElement | null>(null);
    const contentHeight = useReportedContentHeight(frameRef);
    const [expanded, setExpanded] = React.useState(false);

    const measured = contentHeight ?? visualHeights.fallback;
    const collapsible = measured > visualHeights.collapsed;
    const height = clampHeight(collapsible && !expanded ? visualHeights.collapsed : measured);

    return (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
            <div className="relative">
                <iframe
                    className="block w-full border-0 bg-transparent"
                    ref={frameRef}
                    sandbox={visualSandbox}
                    srcDoc={buildVisualSrcDoc(displayHtml, tokensCss)}
                    style={{ height, transition: 'height 200ms cubic-bezier(0.23, 1, 0.32, 1)' }}
                    title={title ?? 'Visual'}
                />
                {collapsible && !expanded ? (
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-card to-transparent" />
                ) : null}
            </div>
            {collapsible ? (
                <button
                    className={cn(
                        'block w-full border-border border-t px-3 py-1.5 text-center text-muted-foreground text-xs',
                        'hover:bg-legacy-muted hover:text-foreground'
                    )}
                    onClick={() => setExpanded((value) => !value)}
                    type="button"
                >
                    {expanded ? 'Show less' : 'Show all'}
                </button>
            ) : null}
        </div>
    );
}

/**
 * Compose the sandbox document: CSP, snapshot of app theme tokens, a minimal
 * base style, and a host-owned size reporter — then the model body. Host
 * plumbing lives in the head so the model content streams last and partial
 * bodies still parse (error-tolerant HTML parsing is the streaming renderer).
 */
export function buildVisualSrcDoc(html: string, tokensCss: string): string {
    const scheme = visualColorScheme();
    return [
        '<!doctype html><html><head><meta charset="utf-8">',
        `<meta http-equiv="Content-Security-Policy" content="${visualCsp}">`,
        '<style>',
        `:root { color-scheme: ${scheme}; ${tokensCss ? `\n${tokensCss}` : ''} }`,
        '* { box-sizing: border-box; }',
        'body { margin: 0; padding: 16px; background: transparent; color: var(--foreground, inherit); font-family: var(--font-sans, system-ui, sans-serif); font-size: var(--app-ui-font-size, 14px); line-height: 1.5; -webkit-font-smoothing: antialiased; }',
        // Plain <table> markup wears the app's ui/table.tsx look, so agents
        // render tabular data as bare HTML tables and get native theming.
        'table { width: 100%; border-collapse: collapse; caption-side: bottom; font-size: var(--app-ui-font-size, 14px); }',
        'th { padding: 8px 12px; text-align: left; vertical-align: middle; font-weight: 500; color: var(--foreground); line-height: 1.1; }',
        'td { padding: 8px 12px; vertical-align: middle; color: var(--muted-foreground); line-height: 1.2; }',
        'tr { border-bottom: 1px solid color-mix(in srgb, var(--border) 60%, transparent); }',
        'tbody tr:hover { background: color-mix(in srgb, var(--foreground) 5%, transparent); }',
        'tfoot { font-weight: 500; } tfoot tr { border-top: 1px solid color-mix(in srgb, var(--border) 60%, transparent); border-bottom: none; }',
        'caption { margin-top: 12px; color: var(--muted-foreground); text-align: left; }',
        '</style>',
        `<script>${sizeReporterScript}</script>`,
        '</head><body>',
        html,
        '</body></html>',
    ].join('\n');
}

// Host-owned plumbing, not a fence capability: reports the document height so
// the card can fit content inside the clamp. The parent trusts nothing else
// from the frame and clamps whatever arrives.
const sizeReporterScript = `(function () {
    var report = function () {
        // Body offsetHeight fits content; documentElement.scrollHeight never
        // shrinks below the frame's own height, so it cannot shrink-to-fit.
        var body = document.body;
        var height = body ? body.offsetHeight : document.documentElement.scrollHeight;
        parent.postMessage({ height: Math.ceil(height), type: 'tavern-visual-size' }, '*');
    };
    addEventListener('DOMContentLoaded', function () {
        report();
        if (typeof ResizeObserver === 'function' && document.body) {
            new ResizeObserver(report).observe(document.body);
        }
    });
    addEventListener('load', report);
})();`;

function clampHeight(value: number) {
    return Math.min(visualHeights.max, Math.max(visualHeights.min, Math.round(value)));
}

// Size messages are only trusted when they come from this card's own frame;
// anything else on the window channel is ignored.
function useReportedContentHeight(frameRef: React.RefObject<HTMLIFrameElement | null>) {
    const [height, setHeight] = React.useState<number | null>(null);

    React.useEffect(() => {
        function onMessage(event: MessageEvent) {
            if (!frameRef.current || event.source !== frameRef.current.contentWindow) {
                return;
            }
            const data = event.data as { height?: unknown; type?: unknown } | null;
            if (data?.type !== 'tavern-visual-size' || typeof data.height !== 'number') {
                return;
            }
            if (Number.isFinite(data.height) && data.height > 0) {
                setHeight(data.height);
            }
        }

        window.addEventListener('message', onMessage);
        return () => window.removeEventListener('message', onMessage);
    }, [frameRef]);

    return height;
}

function useThrottledValue<Value>(value: Value, delayMs: number): Value {
    const [throttled, setThrottled] = React.useState(value);
    const lastUpdateRef = React.useRef(0);

    React.useEffect(() => {
        if (delayMs <= 0) {
            setThrottled(value);
            return;
        }
        const elapsed = Date.now() - lastUpdateRef.current;
        if (elapsed >= delayMs) {
            lastUpdateRef.current = Date.now();
            setThrottled(value);
            return;
        }
        const timer = setTimeout(() => {
            lastUpdateRef.current = Date.now();
            setThrottled(value);
        }, delayMs - elapsed);
        return () => clearTimeout(timer);
    }, [delayMs, value]);

    return throttled;
}

// Snapshot synchronously on first render — an effect-time srcdoc update can
// race the iframe's initial navigation and leave a tokenless document — and
// again when the app theme flips, so visuals follow the active scheme.
function useVisualTokens() {
    const [tokens, setTokens] = React.useState(() => visualTokenDeclarations());

    React.useEffect(() => {
        const observer = new MutationObserver(() => setTokens(visualTokenDeclarations()));
        observer.observe(document.documentElement, {
            attributeFilter: ['data-theme'],
            attributes: true,
        });
        return () => observer.disconnect();
    }, []);

    return tokens;
}
