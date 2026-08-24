import { describe, expect, test } from 'bun:test';
import { parseWidgetPayload, widgetFallbackText } from '../contracts.ts';
import {
    splitVisualFences,
    visualBodyLimit,
    visualFallbackText,
    widgetVisualPropsSchema,
} from './contracts.ts';

describe('visual widget contracts', () => {
    test('accepts an html body with an optional title', () => {
        const props = widgetVisualPropsSchema.parse({
            html: '<div><h1>Weekly sales</h1></div>',
            title: 'Weekly sales',
        });

        expect(props.title).toBe('Weekly sales');
    });

    test('rejects an empty or oversized body', () => {
        expect(widgetVisualPropsSchema.safeParse({ html: '' }).success).toBe(false);
        expect(
            widgetVisualPropsSchema.safeParse({ html: 'x'.repeat(visualBodyLimit + 1) }).success
        ).toBe(false);
    });

    test('rejects unknown props', () => {
        expect(
            widgetVisualPropsSchema.safeParse({ html: '<p>hi</p>', sendPrompt: true }).success
        ).toBe(false);
    });

    test('fallback prefers explicit title, then <title>, then first heading', () => {
        expect(visualFallbackText({ html: '<h2>Ranked</h2>', title: 'Chart' })).toBe('Chart');
        expect(visualFallbackText({ html: '<title>Doc title</title><h1>Heading</h1>' })).toBe(
            'Doc title'
        );
        expect(visualFallbackText({ html: '<h3><em>Ranked</em> teams</h3>' })).toBe('Ranked teams');
        expect(visualFallbackText({ html: '<svg viewBox="0 0 10 10"></svg>' })).toBe('Visual');
    });

    test('splits prose and closed visual fences in order', () => {
        const segments = splitVisualFences(
            'Here you go:\n```visual Weekly sales\n<h1>Sales</h1>\n<svg></svg>\n```\nDone.'
        );

        expect(segments).toEqual([
            { kind: 'text', text: 'Here you go:\n' },
            {
                html: '<h1>Sales</h1>\n<svg></svg>',
                kind: 'visual',
                open: false,
                title: 'Weekly sales',
            },
            { kind: 'text', text: '\nDone.' },
        ]);
    });

    test('treats a trailing unclosed fence as an open streaming visual', () => {
        const segments = splitVisualFences('Drawing now.\n```visual\n<div><h2>Part');

        expect(segments).toEqual([
            { kind: 'text', text: 'Drawing now.\n' },
            { html: '<div><h2>Part', kind: 'visual', open: true },
        ]);
    });

    test('a bare fence opener with no body yet is an open visual', () => {
        const segments = splitVisualFences('```visual');

        expect(segments).toEqual([{ html: '', kind: 'visual', open: true }]);
    });

    test('ignores fence-like text that does not start a line', () => {
        const content = 'Use a `visual` fence like ```visual inline mentions.';

        expect(splitVisualFences(content)).toEqual([{ kind: 'text', text: content }]);
    });

    test('keeps plain content as one text segment', () => {
        expect(splitVisualFences('No fences here.')).toEqual([
            { kind: 'text', text: 'No fences here.' },
        ]);
    });

    test('parses the fence payload into the visual render envelope', () => {
        const parsed = parseWidgetPayload('visual', {
            html: '<h1>Q3 revenue</h1><p>bars</p>',
        });

        expect(parsed.render.component).toBe('grotto.widget.visual');
        expect(parsed.fallbackText).toBe('Q3 revenue');
        expect(widgetFallbackText('visual', { html: '<h1>Q3 revenue</h1>' })).toBe('Q3 revenue');
    });
});
