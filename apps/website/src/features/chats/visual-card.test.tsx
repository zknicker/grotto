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

    expect(doc).toContain('font-size: var(--app-ui-font-size, 14px)');
});

test('the model body streams last so partial documents still parse', () => {
    const doc = buildVisualSrcDoc('<div><h2>Par', '--foreground: #fff;');

    expect(doc.indexOf('grotto-visual-size')).toBeLessThan(doc.indexOf('<div><h2>Par'));
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

test('the sandbox paints native controls with the frame ink, not the browser accent', () => {
    const doc = buildVisualSrcDoc('<input type="range">', '');

    expect(doc).toContain('accent-color: var(--primary, currentColor)');
});

test('the sandbox gives every table its own scroller before the first size report', () => {
    const doc = buildVisualSrcDoc('<table><tr><td>wide</td></tr></table>', '');

    expect(doc).toContain('data-grotto-table-scroll');
    expect(doc).toContain('overflow-x: auto; max-width: 100%; -webkit-overflow-scrolling: touch;');
    expect(doc.indexOf('wrapWideTables();')).toBeLessThan(doc.indexOf('report();'));
    expect(doc.indexOf('report();')).toBeLessThan(doc.indexOf('<table><tr><td>wide</td>'));
    // Layout is untouched, so a narrow table still spans the card.
    expect(doc).toContain('table { width: 100%; border-collapse: collapse;');
    expect(doc).not.toContain('display: block');
    // The height report still comes off the body, wrapper or not.
    expect(doc).toContain('new ResizeObserver(report).observe(document.body)');
});

test('the sandbox keeps a table caption visible while the table pans', () => {
    const doc = buildVisualSrcDoc('<table><caption>Sales</caption></table>', '');

    // Sticky alone is not enough: a caption box is table-wide, so it has to
    // shrink to its content before `left: 0` has anything to hold on to.
    // Verified in WebKit and Chromium against the wrapper the reporter adds.
    expect(doc).toContain(
        'caption { position: sticky; left: 0; width: max-content; max-width: 100%;'
    );
});
