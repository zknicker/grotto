/**
 * Emits the bundled channel icon geometry for the native iPhone app.
 *
 * The curation lives in one place: `apps/website/scripts/generate-channel-icon-catalog.ts`
 * picks the icon families, and this script reads the *names* back out of the
 * catalog it generated. It never re-curates, so the App and the iPhone app can
 * only ever disagree if one of the two generated files is stale.
 *
 * Every hugeicons entry is an array of SVG elements in a 24x24 viewBox. Filled
 * `path` elements keep their `d` verbatim (rounded to three decimals, which is
 * 0.024 of a rendered point at 24pt); `circle` elements become arc path data;
 * the handful of stroked paths keep their stroke width, cap, and join so the
 * Swift renderer can stroke instead of fill. Anything else is skipped and
 * reported.
 *
 *   bun apps/ios-swift/scripts/generate-channel-icon-paths.ts
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const iosRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = join(iosRoot, '../..');
const catalogPath = join(
    repoRoot,
    'apps/website/src/components/chats/channel-icon-catalog.generated.ts'
);
const iconDistPath = join(
    repoRoot,
    'apps/website/node_modules/@hugeicons-pro/core-solid-rounded/dist/esm'
);
const outputPath = join(iosRoot, 'Sources/GrottoUI/Resources/channel-icons.json');

interface Subpath {
    cap?: string;
    d: string;
    join?: string;
    rule?: 'evenodd';
    strokeWidth?: number;
}

const names = [...readFileSync(catalogPath, 'utf8').matchAll(/name: "([A-Za-z0-9]+)"/gu)].map(
    (match) => match[1]
);

if (names.length === 0) {
    throw new Error(`No icon names found in ${catalogPath}. Regenerate the web catalog first.`);
}

const icons: Record<string, Subpath[]> = {};
const skipped: string[] = [];
const emptyIcons: string[] = [];

for (const name of [...new Set(names)].sort()) {
    const module = (await import(pathToFileURL(join(iconDistPath, `${name}.js`)).href)) as {
        default: [string, Record<string, string>][];
    };
    const subpaths: Subpath[] = [];

    for (const [tag, props] of module.default) {
        const subpath = convert(tag, props);
        if (subpath) {
            subpaths.push(subpath);
        } else {
            skipped.push(`${name}:${tag}`);
        }
    }

    if (subpaths.length === 0) {
        emptyIcons.push(name);
        continue;
    }

    icons[name] = subpaths;
}

writeFileSync(outputPath, `${JSON.stringify({ icons, version: 1 })}\n`);

console.log(`${Object.keys(icons).length} icons -> ${outputPath}`);
console.log(`  ${(readFileSync(outputPath).byteLength / 1024 / 1024).toFixed(2)} MiB`);
console.log(
    `  skipped elements: ${skipped.length}${skipped.length ? ` (${skipped.join(', ')})` : ''}`
);
console.log(
    `  icons with no renderable geometry: ${emptyIcons.length}${emptyIcons.length ? ` (${emptyIcons.join(', ')})` : ''}`
);

function convert(tag: string, props: Record<string, string>): Subpath | null {
    if (tag === 'circle') {
        const cx = Number(props.cx);
        const cy = Number(props.cy);
        const r = Number(props.r);
        if (!(Number.isFinite(cx) && Number.isFinite(cy) && Number.isFinite(r)) || r <= 0) {
            return null;
        }
        // Two half arcs, because a single arc back to its own start point is
        // degenerate in the SVG arc spec.
        return {
            d: round(
                `M${cx - r} ${cy}A${r} ${r} 0 1 0 ${cx + r} ${cy}A${r} ${r} 0 1 0 ${cx - r} ${cy}Z`
            ),
        };
    }

    if (tag !== 'path' || typeof props.d !== 'string') {
        return null;
    }

    const subpath: Subpath = { d: round(props.d) };

    if (props.fillRule === 'evenodd') {
        subpath.rule = 'evenodd';
    }

    // A hugeicons path without `fill` is stroked chrome, not a filled shape.
    if (props.stroke && !props.fill) {
        subpath.strokeWidth = Number(props.strokeWidth ?? 1);
        if (props.strokeLinecap) {
            subpath.cap = props.strokeLinecap;
        }
        if (props.strokeLinejoin) {
            subpath.join = props.strokeLinejoin;
        }
    }

    return subpath;
}

/** Trims coordinate precision the 24pt render can never show. */
function round(d: string) {
    return d.replace(/-?\d+\.\d+/gu, (value) =>
        String(Number.parseFloat(Number(value).toFixed(3)))
    );
}
