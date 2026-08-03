import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { buildVisualSrcDoc, VisualCard, visualChartJsUrl } from './visual-card.tsx';

test('renders a sandboxed opaque-origin iframe around the visual body', () => {
    const markup = renderToStaticMarkup(
        <VisualCard html="<h1>Weekly sales</h1><svg></svg>" title="Weekly sales" />
    );

    expect(markup).toContain('<iframe');
    expect(markup).toContain(
        'sandbox="allow-forms allow-modals allow-pointer-lock allow-popups allow-scripts"'
    );
    expect(markup).not.toContain('allow-same-origin');
    expect(markup).toContain('title="Weekly sales"');
    expect(markup).toContain('&lt;h1&gt;Weekly sales&lt;/h1&gt;');
});

test('the sandbox document pins external sources to the Chart.js CDN', () => {
    const doc = buildVisualSrcDoc('<div>chart</div>', '');

    expect(doc).toContain('Content-Security-Policy');
    expect(doc).toContain("default-src 'none'");
    expect(doc).toContain(
        "script-src 'unsafe-inline' https://cdn.jsdelivr.net/npm/chart.js@4.5.1/"
    );
    expect(doc).toContain("connect-src 'none'");
    expect(visualChartJsUrl.startsWith('https://cdn.jsdelivr.net/npm/chart.js@4.5.1/')).toBe(true);
});

test('the sandbox fallback uses HeroUI body typography', () => {
    const doc = buildVisualSrcDoc('<p>Body</p>', '');

    expect(doc).toContain('font-size: var(--app-ui-font-size, 16px)');
});

test('the model body streams last so partial documents still parse', () => {
    const doc = buildVisualSrcDoc('<div><h2>Par', '--foreground: #fff;');

    expect(doc.indexOf('tavern-visual-size')).toBeLessThan(doc.indexOf('<div><h2>Par'));
    expect(doc.indexOf('--foreground: #fff;')).toBeLessThan(doc.indexOf('<div><h2>Par'));
    expect(doc.trimEnd().endsWith('</body></html>')).toBe(true);
});

test('malformed html still renders inside the sandbox instead of failing', () => {
    const markup = renderToStaticMarkup(
        <VisualCard html={'<div><h1>Broken<span style="color:'} open />
    );

    expect(markup).toContain('<iframe');
    expect(markup).toContain('Broken');
});
