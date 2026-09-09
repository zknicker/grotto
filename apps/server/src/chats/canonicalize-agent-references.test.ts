import { describe, expect, it } from 'bun:test';
import { formatAgentReferenceTarget, formatChatReferenceTarget } from '@grotto/api';
import { canonicalizeAgentMessageContent } from './canonicalize-agent-references.ts';

const agents = [
    { handle: 'blippy', id: 'agt_blippy' },
    { handle: 'tiny', id: 'agt_tiny' },
];
const channels = [{ id: 'cht_product', name: 'product' }];

describe('canonicalizeAgentMessageContent', () => {
    it('rewrites known bare Agent and channel references to stable links', () => {
        expect(
            canonicalizeAgentMessageContent('Ask @blippy and @tiny in #product.', {
                agents,
                channels,
            })
        ).toBe(
            `Ask [@blippy](${formatAgentReferenceTarget('agt_blippy')}) and [@tiny](${formatAgentReferenceTarget('agt_tiny')}) in [#product](${formatChatReferenceTarget('cht_product')}).`
        );
    });

    it('matches reference handles case-insensitively without changing ordinary text', () => {
        expect(
            canonicalizeAgentMessageContent(
                'Email blippy@example.com, mention @BLIPPY; #PRODUCT works, but #123 stays.',
                { agents, channels }
            )
        ).toBe(
            `Email blippy@example.com, mention [@BLIPPY](${formatAgentReferenceTarget('agt_blippy')}); [#PRODUCT](${formatChatReferenceTarget('cht_product')}) works, but #123 stays.`
        );
    });

    it('does not treat repeated reference sigils as a bare reference', () => {
        expect(
            canonicalizeAgentMessageContent('@@blippy and ##product stay raw.', {
                agents,
                channels,
            })
        ).toBe('@@blippy and ##product stay raw.');
    });

    it('does not rewrite handles embedded in plain URLs', () => {
        expect(
            canonicalizeAgentMessageContent(
                'See https://example.com/@tiny and www.example.com/@blippy.',
                { agents, channels: [] }
            )
        ).toBe('See https://example.com/@tiny and www.example.com/@blippy.');
    });

    it('skips fenced and inline code, existing links, and unknown targets', () => {
        const content = [
            'Keep @blippy and #product.',
            '`@tiny #product` stays code.',
            '```md',
            '@blippy #product',
            '```',
            'Already [@tiny](agent://agt_tiny) and [#product](chat://cht_product).',
            'Unknown @nobody #missing.',
        ].join('\n');

        expect(canonicalizeAgentMessageContent(content, { agents, channels })).toBe(
            [
                `Keep [@blippy](${formatAgentReferenceTarget('agt_blippy')}) and [#product](${formatChatReferenceTarget('cht_product')}).`,
                '`@tiny #product` stays code.',
                '```md',
                '@blippy #product',
                '```',
                'Already [@tiny](agent://agt_tiny) and [#product](chat://cht_product).',
                'Unknown @nobody #missing.',
            ].join('\n')
        );
    });

    // A replay canonicalizes the retry against the targets already stored in the
    // announcement, so a Message that names one teammate twice hands this the
    // same target twice. Treating that as an ambiguous label left the retry
    // uncanonicalized and refused the idempotent create as a conflict.
    it('treats a target repeated under one label as that target, not ambiguity', () => {
        expect(
            canonicalizeAgentMessageContent('Meet @orbit. @orbit owns notes in #product.', {
                agents: [
                    { handle: 'orbit', id: 'agt_orbit' },
                    { handle: 'orbit', id: 'agt_orbit' },
                ],
                channels: [
                    { id: 'cht_product', name: 'product' },
                    { id: 'cht_product', name: 'product' },
                ],
            })
        ).toBe(
            `Meet [@orbit](${formatAgentReferenceTarget('agt_orbit')}). [@orbit](${formatAgentReferenceTarget('agt_orbit')}) owns notes in [#product](${formatChatReferenceTarget('cht_product')}).`
        );
    });

    it('leaves a label genuinely claimed by two targets alone', () => {
        expect(
            canonicalizeAgentMessageContent('See #product.', {
                agents: [],
                channels: [
                    { id: 'cht_one', name: 'product' },
                    { id: 'cht_two', name: 'product' },
                ],
            })
        ).toBe('See #product.');
    });

    it('never rebinds an existing stable link when a handle is reused', () => {
        const content = 'Historical [@blippy](agent://agt_old) and current @blippy are distinct.';

        expect(
            canonicalizeAgentMessageContent(content, {
                agents: [{ handle: 'blippy', id: 'agt_new' }],
                channels,
            })
        ).toBe(
            `Historical [@blippy](agent://agt_old) and current [@blippy](${formatAgentReferenceTarget('agt_new')}) are distinct.`
        );
    });
});
