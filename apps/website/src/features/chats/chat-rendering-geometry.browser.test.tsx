import { afterAll, beforeAll, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { type Browser, chromium, type Page } from '@playwright/test';
import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ChatMarkdownText } from './chat-markdown-text.tsx';
import {
    ChatTranscriptMessageContent,
    renderTranscriptMessageAttachments,
    type TranscriptMessage,
} from './chat-transcript-message.tsx';
import { TranscriptMessageBlock } from './chat-transcript-message-block.tsx';

const appointmentText =
    'Your next dentist appointment is Dental Cleaning on Monday, September 28, 2026 at 10:00 AM EDT, at Meridian Dental, NYC. 🫡';
const chatCss = readFileSync(new URL('./chat.css', import.meta.url), 'utf8');

let browser: Browser;

beforeAll(async () => {
    browser = await chromium.launch({ headless: true });
});

afterAll(async () => {
    await browser.close();
});

test('streaming word lift changes paint position without changing line layout', async () => {
    const page = await newGeometryPage(`
        <style>
            ${baseTextCss}

            @keyframes chat-streaming-text-unit-in {
                from {
                    opacity: 0;
                    transform: translateY(0.45em);
                    filter: blur(1px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                    filter: blur(0);
                }
            }

            .chat-streaming-text-unit {
                display: inline-block;
                line-height: inherit;
                vertical-align: baseline;
                animation: chat-streaming-text-unit-in 720ms cubic-bezier(0.16, 1, 0.3, 1) both paused;
            }
        </style>
        <div class="case" id="plain">
            <span class="target">Dental</span>
        </div>
        <div class="case" id="streaming">
            <span class="target chat-streaming-text-unit">Dental</span>
        </div>
    `);

    const metrics = await page.evaluate(() => {
        const readMetrics = (id: string) => {
            const root = document.getElementById(id);
            const target = root?.querySelector('.target');

            if (!(root instanceof HTMLElement && target instanceof HTMLElement)) {
                throw new Error(`Missing geometry target ${id}.`);
            }

            const rootRect = root.getBoundingClientRect();
            const targetRect = target.getBoundingClientRect();

            return {
                boxHeight: rootRect.height,
                offsetTop: targetRect.top - rootRect.top,
            };
        };

        return {
            plain: readMetrics('plain'),
            streaming: readMetrics('streaming'),
        };
    });

    expect(metrics.streaming.boxHeight).toBe(metrics.plain.boxHeight);
    expect(metrics.streaming.offsetTop - metrics.plain.offsetTop).toBeGreaterThan(3);

    await page.close();
});

test('active and durable assistant reply wrappers keep the same text geometry', async () => {
    const liveMarkup = renderChatMarkup(
        <TranscriptMessageBlock animateEnter={false} from="assistant">
            <ChatMarkdownText content={appointmentText} />
        </TranscriptMessageBlock>
    );
    const durableMarkup = renderChatMarkup(
        <TranscriptMessageBlock
            animateEnter={false}
            attachments={renderTranscriptMessageAttachments(
                assistantMessage(appointmentText).attachments
            )}
            from="assistant"
        >
            <ChatTranscriptMessageContent message={assistantMessage(appointmentText)} />
        </TranscriptMessageBlock>
    );
    const page = await newGeometryPage(`
        <style>
            ${chatMessageCss}
        </style>
        <div class="reply-case" id="live">${liveMarkup}</div>
        <div class="reply-case" id="durable">${durableMarkup}</div>
    `);

    const metrics = await page.evaluate(() => {
        const readMetrics = (id: string) => {
            const root = document.getElementById(id);
            const body = root?.querySelector('[data-slot="chat-message-content"]');
            const textRoot = body?.querySelector('[data-selectable-text]') ?? body;

            if (
                !(
                    root instanceof HTMLElement &&
                    body instanceof HTMLElement &&
                    textRoot instanceof Node
                )
            ) {
                throw new Error(`Missing reply geometry target ${id}.`);
            }

            const rootRect = root.getBoundingClientRect();
            const range = document.createRange();
            range.selectNodeContents(textRoot);

            const bodyRect = body.getBoundingClientRect();
            const textRect = Array.from(range.getClientRects()).find((rect) => rect.width > 0);

            if (!textRect) {
                throw new Error(`Missing text rect ${id}.`);
            }

            return {
                bodyTop: bodyRect.top - rootRect.top,
                bodyHeight: bodyRect.height,
                rootHeight: rootRect.height,
                textTop: textRect.top - bodyRect.top,
            };
        };

        return {
            durable: readMetrics('durable'),
            live: readMetrics('live'),
        };
    });

    expect(Math.abs(metrics.durable.bodyTop - metrics.live.bodyTop)).toBeLessThanOrEqual(0.5);
    expect(metrics.durable.bodyHeight).toBe(metrics.live.bodyHeight);
    expect(Math.abs(metrics.durable.rootHeight - metrics.live.rootHeight)).toBeLessThanOrEqual(0.5);
    expect(Math.abs(metrics.durable.textTop - metrics.live.textTop)).toBeLessThanOrEqual(0.5);

    await page.close();
});

test('settled Markdown keeps visible rhythm between paragraphs', async () => {
    const markup = renderToStaticMarkup(
        <ChatMarkdownText content={'First paragraph.\n\nSecond paragraph.'} />
    );
    const page = await newGeometryPage(`
        <style>
            * { margin: 0; }
            .markdown p { margin-bottom: 12px; }
            .markdown p:last-child { margin-bottom: 0; }
            .markdown__block { width: 100%; }
            ${chatCss}
        </style>
        <div id="message">${markup}</div>
    `);

    const gap = await page.evaluate(() => {
        const paragraphs = document.querySelectorAll('#message p');
        const first = paragraphs.item(0).getBoundingClientRect();
        const second = paragraphs.item(1).getBoundingClientRect();

        return second.top - first.bottom;
    });

    expect(gap).toBe(12);

    await page.close();
});

test('work disclosure anchoring keeps the header pinned while content expands below it', async () => {
    const page = await newGeometryPage(`
        <style>
            ${baseTextCss}

            .scroll-case {
                height: 220px;
                margin: 24px;
                overflow-y: auto;
                border: 1px solid #ddd;
            }

            .spacer-before {
                height: 260px;
            }

            .spacer-after {
                height: 520px;
            }

            .work-header {
                height: 32px;
                display: flex;
                align-items: center;
                padding: 0 12px;
                background: #f5f5f5;
            }

            .work-panel {
                height: 0;
                overflow: hidden;
                background: #fafafa;
            }
        </style>
        <div class="scroll-case" id="scroll-case">
            <div class="spacer-before"></div>
            <button class="work-header" id="work-header" type="button">Read 2 files</button>
            <div class="work-panel" id="work-panel"></div>
            <div class="spacer-after"></div>
        </div>
    `);

    const metrics = await page.evaluate(() => {
        const viewport = document.getElementById('scroll-case');
        const header = document.getElementById('work-header');
        const panel = document.getElementById('work-panel');

        if (
            !(
                viewport instanceof HTMLElement &&
                header instanceof HTMLElement &&
                panel instanceof HTMLElement
            )
        ) {
            throw new Error('Missing work disclosure geometry target.');
        }

        viewport.scrollTop = header.offsetTop - 92;

        const beforeHeaderRect = header.getBoundingClientRect();
        const capturedTop = beforeHeaderRect.top;
        panel.style.height = '220px';

        // Simulate the competing end-follow adjustment that used to yank the
        // clicked header upward when a virtualized row grew below it.
        viewport.scrollTop += 220;
        const yankedTop = header.getBoundingClientRect().top;

        const delta = header.getBoundingClientRect().top - capturedTop;
        viewport.scrollTop += delta;

        const afterHeaderRect = header.getBoundingClientRect();
        const afterPanelRect = panel.getBoundingClientRect();

        return {
            afterHeaderBottom: afterHeaderRect.bottom,
            afterHeaderTop: afterHeaderRect.top,
            afterPanelHeight: afterPanelRect.height,
            afterPanelTop: afterPanelRect.top,
            beforeHeaderTop: beforeHeaderRect.top,
            yankedTop,
        };
    });

    expect(metrics.yankedTop).toBeLessThan(metrics.beforeHeaderTop - 160);
    expect(Math.abs(metrics.afterHeaderTop - metrics.beforeHeaderTop)).toBeLessThanOrEqual(0.5);
    expect(metrics.afterPanelHeight).toBe(220);
    expect(metrics.afterPanelTop).toBeGreaterThanOrEqual(metrics.afterHeaderBottom - 0.5);

    await page.close();
});

function renderChatMarkup(node: ReactNode): string {
    return renderToStaticMarkup(node);
}

async function newGeometryPage(body: string): Promise<Page> {
    const page = await browser.newPage({
        deviceScaleFactor: 2,
        viewport: { height: 360, width: 1200 },
    });

    await page.setContent(`<!doctype html><html><body>${body}</body></html>`);

    return page;
}

const baseTextCss = `
    body {
        margin: 0;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        font-size: 14px;
    }

    .case {
        min-height: 20px;
        margin: 40px;
        color: #111;
        font-size: 14px;
        line-height: 1.5;
        white-space: pre-wrap;
        overflow-wrap: anywhere;
    }
`;

const chatMessageCss = `
    ${baseTextCss}

    p {
        margin: 0;
    }

    .reply-case {
        margin: 40px;
    }

    .group {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        min-width: 0;
        max-width: 100%;
        gap: 6px;
        font-size: 14px;
        line-height: 1.5;
    }

    .max-w-full {
        max-width: 100%;
    }

    .whitespace-pre-wrap {
        white-space: pre-wrap;
    }

    .break-words {
        word-break: normal;
        overflow-wrap: anywhere;
    }

    .text-sm {
        font-size: 14px;
        line-height: 1.5;
    }

    /* Mirrors the stock chat-message__content type scale. */
    .chat-message__content {
        font-size: 14px;
        line-height: 1.5;
    }
`;

function assistantMessage(content: string): TranscriptMessage {
    return {
        attachments: [],
        content,
        id: 'msg_assistant_geometry',
        metadata: { runtime: { runId: 'run_geometry' } },
        sender: 'Agent',
        senderType: 'agent',
        sourceSessionId: null,
        sourceSessionKey: 'agent:main:grotto:channel:geometry',
        grottoAgentId: 'agt_main',
        timestamp: '2026-06-18T20:35:17.000Z',
    };
}
