// Regenerates packages/agent-workspace/src/visuals-skill/icons.ts from the app's
// HugeIcons solid-rounded set. Run from apps/runtime:
//   bun scripts/generate-visuals-skill-icons.mjs
// The curated catalog below is the source of truth for which icons the
// visuals skill ships; edit it and rerun to change the set.

import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const iconPackage = path.join(
    here,
    '../../website/node_modules/@hugeicons-pro/core-solid-rounded/dist/esm/index.js'
);
const outFile = path.join(here, '../../../packages/agent-workspace/src/visuals-skill/icons.ts');

// name: skill-facing file stem (kebab). export: HugeIcons export name.
// aliases/useFor/avoidFor mirror the Kimi manifest shape for agent lookup.
const catalog = [
    [
        'search',
        'Search01Icon',
        'general',
        ['find', 'lookup', 'magnifier'],
        'search fields, lookup buttons',
    ],
    ['add', 'Add01Icon', 'general', ['plus', 'create', 'new'], 'add/create actions'],
    [
        'remove',
        'Remove01Icon',
        'general',
        ['minus', 'subtract'],
        'remove from a set',
        'deleting records (use delete)',
    ],
    ['close', 'Cancel01Icon', 'general', ['x', 'dismiss', 'cancel'], 'dismiss/close affordances'],
    ['check', 'Tick02Icon', 'status', ['tick', 'done', 'confirm'], 'completed or confirmed states'],
    [
        'check-circle',
        'CheckmarkCircle02Icon',
        'status',
        ['success', 'passed'],
        'success badges and result rows',
    ],
    [
        'settings',
        'Settings02Icon',
        'general',
        ['gear', 'preferences', 'config'],
        'settings and configuration',
    ],
    ['edit', 'Edit02Icon', 'editor', ['pencil', 'modify', 'rename'], 'edit actions'],
    ['delete', 'Delete02Icon', 'editor', ['trash', 'bin', 'destroy'], 'destructive delete actions'],
    ['copy', 'Copy01Icon', 'editor', ['duplicate', 'clipboard'], 'copy-to-clipboard, duplicate'],
    ['save', 'FloppyDiskIcon', 'editor', ['persist', 'store'], 'save actions'],
    ['filter', 'FilterHorizontalIcon', 'input', ['refine', 'facet'], 'filter controls'],
    ['sort-asc', 'SortByUp01Icon', 'input', ['ascending', 'order'], 'ascending sort headers'],
    ['sort-desc', 'SortByDown01Icon', 'input', ['descending', 'order'], 'descending sort headers'],
    ['menu', 'Menu01Icon', 'navigation', ['hamburger', 'nav'], 'menu toggles'],
    [
        'more-horizontal',
        'MoreHorizontalIcon',
        'navigation',
        ['ellipsis', 'overflow', 'kebab'],
        'overflow action menus',
    ],
    [
        'more-vertical',
        'MoreVerticalIcon',
        'navigation',
        ['ellipsis', 'overflow'],
        'vertical overflow menus',
    ],
    ['drag', 'DragDropIcon', 'input', ['reorder', 'handle', 'grip'], 'drag handles'],
    ['move', 'MoveIcon', 'input', ['pan', 'relocate'], 'move/relocate actions'],
    ['pin', 'PinIcon', 'general', ['stick', 'keep'], 'pinned items'],
    ['tag', 'Tag01Icon', 'general', ['label', 'category'], 'tags and labels'],
    ['bookmark', 'Bookmark01Icon', 'general', ['saved', 'favorite'], 'saved-for-later items'],
    ['star', 'StarIcon', 'general', ['rating', 'favorite'], 'ratings, starred items'],
    ['heart', 'FavouriteIcon', 'general', ['like', 'love'], 'like/favorite reactions'],
    ['thumbs-up', 'ThumbsUpIcon', 'chat', ['approve', 'upvote'], 'approval, positive feedback'],
    [
        'thumbs-down',
        'ThumbsDownIcon',
        'chat',
        ['reject', 'downvote'],
        'rejection, negative feedback',
    ],
    ['target', 'Target01Icon', 'general', ['goal', 'aim', 'objective'], 'goals and targets'],
    ['rocket', 'Rocket01Icon', 'general', ['launch', 'ship', 'deploy'], 'launches, releases'],
    [
        'idea',
        'Idea01Icon',
        'general',
        ['lightbulb', 'insight', 'tip'],
        'tips, insights, suggestions',
    ],
    ['help', 'HelpCircleIcon', 'status', ['question', 'support', 'faq'], 'help affordances'],
    ['info', 'InformationCircleIcon', 'status', ['about', 'note'], 'informational callouts'],
    ['alert', 'Alert02Icon', 'status', ['warning', 'caution', 'triangle'], 'warnings'],
    [
        'alert-circle',
        'AlertCircleIcon',
        'status',
        ['error', 'attention'],
        'errors, blocking problems',
    ],
    ['zoom-in', 'ZoomInAreaIcon', 'input', ['magnify', 'enlarge'], 'zoom-in controls'],
    ['zoom-out', 'ZoomOutAreaIcon', 'input', ['reduce', 'shrink'], 'zoom-out controls'],
    ['maximize', 'Maximize01Icon', 'navigation', ['fullscreen', 'enlarge'], 'expand to full size'],
    ['minimize', 'Minimize01Icon', 'navigation', ['restore', 'shrink'], 'restore from full size'],
    ['expand', 'ArrowExpandIcon', 'navigation', ['grow', 'open out'], 'expanding regions'],
    ['collapse', 'ArrowShrinkIcon', 'navigation', ['contract', 'close in'], 'collapsing regions'],
    ['refresh', 'RefreshIcon', 'general', ['sync', 'update'], 'refresh/sync actions'],
    ['reload', 'ReloadIcon', 'general', ['retry', 'rerun'], 'retry/rerun actions'],
    ['loading', 'Loading03Icon', 'status', ['spinner', 'busy', 'progress'], 'loading indicators'],
    ['arrow-up', 'ArrowUp01Icon', 'arrows', ['up', 'increase'], 'upward direction, increases'],
    [
        'arrow-down',
        'ArrowDown01Icon',
        'arrows',
        ['down', 'decrease'],
        'downward direction, decreases',
    ],
    ['arrow-left', 'ArrowLeft01Icon', 'arrows', ['back', 'previous'], 'back navigation'],
    ['arrow-right', 'ArrowRight01Icon', 'arrows', ['forward', 'next'], 'forward navigation'],
    [
        'arrow-up-right',
        'ArrowUpRight01Icon',
        'arrows',
        ['external', 'growth', 'positive delta'],
        'positive deltas, outbound links',
    ],
    ['message', 'Message01Icon', 'chat', ['dm', 'text'], 'messages and DMs'],
    ['comment', 'Comment01Icon', 'chat', ['reply', 'discussion'], 'comments and replies'],
    ['chat', 'Chatting01Icon', 'chat', ['conversation', 'thread'], 'conversations'],
    ['send', 'SentIcon', 'chat', ['submit', 'paper plane'], 'send actions'],
    ['attachment', 'Attachment01Icon', 'chat', ['clip', 'file attach'], 'attachments'],
    [
        'notification',
        'Notification03Icon',
        'chat',
        ['bell', 'alert'],
        'notifications',
        'warnings (use alert)',
    ],
    ['mail', 'Mail02Icon', 'chat', ['email', 'envelope'], 'email'],
    ['call', 'CallIcon', 'chat', ['phone', 'dial'], 'phone calls'],
    ['home', 'Home04Icon', 'navigation', ['house', 'start'], 'home navigation'],
    ['globe', 'Globe02Icon', 'navigation', ['world', 'web', 'international'], 'web, global scope'],
    [
        'location',
        'Location04Icon',
        'navigation',
        ['pin', 'place', 'map marker'],
        'places, addresses',
    ],
    ['map', 'MapsLocation01Icon', 'navigation', ['directions', 'route'], 'maps and routes'],
    ['image', 'Image01Icon', 'media', ['photo', 'picture'], 'images'],
    ['camera', 'Camera01Icon', 'media', ['photo', 'capture'], 'capture actions'],
    ['mic', 'Mic01Icon', 'media', ['microphone', 'voice', 'record'], 'voice input'],
    ['volume-on', 'VolumeHighIcon', 'media', ['sound', 'audio', 'speaker'], 'audio on'],
    ['volume-off', 'VolumeOffIcon', 'media', ['mute', 'silent'], 'audio muted'],
    ['play', 'PlayIcon', 'media', ['start', 'resume'], 'play/start actions'],
    ['pause', 'PauseIcon', 'media', ['hold', 'suspend'], 'pause actions'],
    ['stop', 'StopIcon', 'media', ['halt', 'end'], 'stop actions'],
    ['folder', 'Folder01Icon', 'file', ['directory'], 'folders and groups'],
    ['file', 'File01Icon', 'file', ['document', 'page'], 'generic files'],
    ['file-code', 'DocumentCodeIcon', 'file', ['source', 'script'], 'code files'],
    [
        'download',
        'Download04Icon',
        'file',
        ['save locally', 'export'],
        'downloads',
        'uploads (use upload)',
    ],
    [
        'upload',
        'Upload04Icon',
        'file',
        ['import', 'send file'],
        'uploads',
        'downloads (use download)',
    ],
    [
        'share',
        'Share08Icon',
        'file',
        ['send to', 'distribute'],
        'sharing',
        'file export (use download)',
    ],
    ['link', 'Link04Icon', 'file', ['url', 'chain', 'connect'], 'links between things'],
    [
        'external-link',
        'LinkSquare01Icon',
        'file',
        ['open in new', 'outbound'],
        'links leaving the surface',
    ],
    ['print', 'PrinterIcon', 'file', ['paper', 'hardcopy'], 'print actions'],
    [
        'lock',
        'SquareLock01Icon',
        'system',
        ['secure', 'private', 'locked'],
        'locked/private states',
    ],
    ['unlock', 'SquareUnlock01Icon', 'system', ['open', 'accessible'], 'unlocked states'],
    ['shield', 'Shield01Icon', 'system', ['security', 'protection'], 'security features'],
    ['key', 'Key01Icon', 'system', ['credential', 'secret', 'api key'], 'credentials and access'],
    ['view', 'ViewIcon', 'general', ['eye', 'visible', 'show'], 'visibility on'],
    ['view-off', 'ViewOffIcon', 'general', ['hidden', 'hide'], 'visibility off'],
    ['bug', 'Bug01Icon', 'system', ['defect', 'issue'], 'bugs and defects'],
    ['chart-bar', 'BarChartIcon', 'data', ['bars', 'comparison'], 'bar-chart references'],
    [
        'chart-column',
        'ChartHistogramIcon',
        'data',
        ['histogram', 'distribution'],
        'column/histogram references',
    ],
    ['chart-line', 'ChartLineData01Icon', 'data', ['trend', 'timeseries'], 'line-chart references'],
    [
        'chart-pie',
        'PieChartIcon',
        'data',
        ['share', 'proportion', 'donut'],
        'part-of-whole references',
    ],
    [
        'analytics',
        'Analytics01Icon',
        'data',
        ['metrics', 'stats', 'dashboard'],
        'analytics surfaces',
    ],
    ['database', 'DatabaseIcon', 'data', ['storage', 'db', 'records'], 'databases'],
    ['server', 'ServerStack01Icon', 'data', ['infra', 'host', 'backend'], 'servers and infra'],
    ['cloud', 'CloudIcon', 'data', ['hosted', 'remote'], 'cloud services'],
    ['code', 'SourceCodeIcon', 'data', ['brackets', 'source'], 'code references'],
    ['terminal', 'TerminalIcon', 'data', ['cli', 'shell', 'console'], 'terminal references'],
    ['wifi', 'Wifi01Icon', 'system', ['network', 'connectivity', 'online'], 'connectivity states'],
    ['flash', 'FlashIcon', 'general', ['zap', 'fast', 'instant'], 'speed, instant actions'],
    ['user', 'UserIcon', 'people', ['person', 'account', 'profile'], 'single person'],
    ['users', 'UserMultiple02Icon', 'people', ['pair', 'members'], 'a few people'],
    ['user-group', 'UserGroupIcon', 'people', ['team', 'audience', 'crowd'], 'teams and groups'],
    ['calendar', 'Calendar03Icon', 'time', ['date', 'schedule'], 'dates and schedules'],
    ['clock', 'Clock01Icon', 'time', ['time', 'duration', 'recent'], 'times and durations'],
    ['credit-card', 'CreditCardIcon', 'commerce', ['payment', 'billing'], 'payments'],
    ['cart', 'ShoppingCart01Icon', 'commerce', ['basket', 'checkout'], 'shopping and checkout'],
    ['package', 'PackageIcon', 'commerce', ['box', 'shipment', 'bundle'], 'packages and bundles'],
    [
        'delivery',
        'DeliveryTruck01Icon',
        'commerce',
        ['shipping', 'truck', 'logistics'],
        'shipping and delivery',
    ],
    [
        'sun',
        'Sun03Icon',
        'general',
        ['light mode', 'day', 'weather'],
        'light theme, daytime, clear weather',
    ],
    ['moon', 'Moon02Icon', 'general', ['dark mode', 'night'], 'dark theme, nighttime'],
    ['fire', 'FireIcon', 'general', ['hot', 'streak', 'trending'], 'trending, streaks'],
    ['droplet', 'DropletIcon', 'general', ['water', 'liquid', 'humidity'], 'liquid, humidity'],
    ['leaf', 'Leaf01Icon', 'general', ['eco', 'nature', 'organic'], 'nature, sustainability'],
    [
        'battery',
        'BatteryFullIcon',
        'system',
        ['power', 'charge', 'energy'],
        'power and charge levels',
    ],
];

const icons = await import(iconPackage);

const files = {};
const manifest = [];
for (const [name, exportName, category, aliases, useFor, avoidFor] of catalog) {
    const data = icons[exportName];
    if (!data) {
        throw new Error(`Missing HugeIcons export: ${exportName}`);
    }
    const file = `${name}.svg`;
    files[file] = renderSvg(data);
    manifest.push({
        aliases,
        ...(avoidFor ? { avoid_for: avoidFor } : {}),
        category,
        file,
        name,
        use_for: useFor,
    });
}

const banner = `/**
 * Generated by scripts/generate-visuals-skill-icons.mjs — do not edit.
 * Curated HugeIcons solid-rounded subset shipped as visuals skill assets.
 */`;

const source = `${banner}

export interface VisualsSkillIconEntry {
    aliases: string[];
    avoid_for?: string;
    category: string;
    file: string;
    name: string;
    use_for: string;
}

export const visualsSkillIconManifest: VisualsSkillIconEntry[] = ${JSON.stringify(manifest, null, 4)};

export const visualsSkillIconFiles: Record<string, string> = ${JSON.stringify(files, null, 4)};
`;

await writeFile(outFile, source);
console.log(`Wrote ${manifest.length} icons to ${path.relative(process.cwd(), outFile)}`);

function renderSvg(data) {
    const body = data
        .map(([tag, attrs]) => {
            const rendered = Object.entries(attrs)
                .filter(([key]) => key !== 'key')
                .map(([key, value]) => `${kebab(key)}="${value}"`)
                .join(' ');
            return `<${tag} ${rendered}/>`;
        })
        .join('');
    return `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">${body}</svg>`;
}

function kebab(value) {
    return value.replace(/[A-Z]/gu, (letter) => `-${letter.toLowerCase()}`);
}
