import { developmentChatDemoIds } from '@tavern/api/development-chat-demos';
import {
    assistantMessage,
    type DevelopmentChatDemo,
    ownerMessage,
    userMessage,
} from './development-chat-demo-types';

const longPastedOAuthJson =
    '{"installed":{"client_id":"535034123734-jckkmfjk3qajgeo8mhcstmtkbdrt0gn2.apps.googleusercontent.com","project_id":"tavern-static-preview","auth_uri":"https://accounts.google.com/o/oauth2/auth","token_uri":"https://oauth2.googleapis.com/token","auth_provider_x509_cert_url":"https://www.googleapis.com/oauth2/v1/certs","client_secret":"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cret","redirect_uris":["http://localhost"]}}';
const longOAuthConsentUrl =
    'https://accounts.google.com/o/oauth2/auth?response_type=code&client_id=535034123734-jckkmfjk3qajgeo8mhcstmtkbdrt0gn2.apps.googleusercontent.com&redirect_uri=http%3A%2F%2Flocalhost%3A1&scope=https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fcalendar.events.readonly&access_type=offline&prompt=consent&state=tavern_static_preview_long_agent_response_token';

export function artifactLinksDemo(ottoId: string): DevelopmentChatDemo {
    return completedTextDemo({
        agentId: ottoId,
        chatId: developmentChatDemoIds.artifactLinks,
        request: 'Show me the inspectable outputs you created.',
        reply: [
            'Created two inspectable workspace notes:',
            '',
            '- [Artifact Panel brief](grotto://workspace/notes/panel-brief.md)',
            '- [Inspectable output rules](grotto://workspace/notes/output-rules.md)',
            '',
            'This one opens the panel with the current unsupported state: [preview.html](grotto://workspace/out/preview.html).',
        ].join('\n'),
        slug: 'artifact_links',
        title: 'Demo: Artifact Links',
    });
}

export function longContentDemo(ottoId: string): DevelopmentChatDemo {
    return completedTextDemo({
        agentId: ottoId,
        chatId: developmentChatDemoIds.longContent,
        title: 'Demo: Long Content',
        request: longPastedOAuthJson,
        reply: `Auth URL created. Open this URL:\n\n${longOAuthConsentUrl}\n\nAfter authorizing, copy the localhost callback URL and paste it here.`,
        slug: 'long_content',
    });
}

export function attachmentDemo(ottoId: string): DevelopmentChatDemo {
    const chatId = developmentChatDemoIds.attachment;
    const runId = 'run_demo_attachment';
    const requestMessageId = 'msg_demo_attachment_request';
    const responseMessageId = 'msg_demo_attachment_response';

    return {
        agentIds: [ottoId],
        chatId,
        title: 'Demo: Attachment',
        messages: [
            userMessage({
                agentId: ottoId,
                attachments: [
                    {
                        filename: 'weather-request.txt',
                        mediaType: 'text/plain',
                        path: '/attachments/weather-request.txt',
                        sizeBytes: 184,
                        type: 'file',
                    },
                ],
                chatId,
                content: 'hi dude, can you please fetch the weather in the 5 biggest us cities',
                id: requestMessageId,
                nonce: 'demo-attachment-request',
            }),
            assistantMessage({
                agentId: ottoId,
                chatId,
                content: 'Yep. I can use the attached brief and keep the response compact.',
                id: responseMessageId,
                nonce: 'demo-attachment-response',
                requestMessageId,
                runId,
            }),
        ],
    };
}

function completedTextDemo(input: {
    agentId: string;
    chatId: string;
    request: string;
    reply: string;
    slug: string;
    title: string;
}): DevelopmentChatDemo {
    const runId = `run_demo_${input.slug}`;
    const requestMessageId = `msg_demo_${input.slug}_request`;
    const responseMessageId = `msg_demo_${input.slug}_response`;

    return {
        agentIds: [input.agentId],
        chatId: input.chatId,
        title: input.title,
        messages: [
            userMessage({
                agentId: input.agentId,
                chatId: input.chatId,
                content: input.request,
                id: requestMessageId,
                nonce: `demo-${input.slug}-request`,
            }),
            assistantMessage({
                agentId: input.agentId,
                chatId: input.chatId,
                content: input.reply,
                id: responseMessageId,
                nonce: `demo-${input.slug}-response`,
                requestMessageId,
                runId,
            }),
        ],
    };
}

// A short exchange authored by the app owner (`usr_tavern`) rather than the
// other demo participant, so the consolidated demo shows the viewer's own
// right-anchored, avatar-less bubbles alongside the left roster.
const selfDemoTurns = [
    {
        ask: 'Can you give me a quick status on the launch?',
        reply: 'All green — the last deploy passed and there are no open incidents.',
    },
    {
        ask: 'Nice. Anything I should double-check before I sign off?',
        reply: 'Just confirm the release note reads cleanly; everything else is verified.',
    },
] as const;

export function selfMessagesDemo(ottoId: string): DevelopmentChatDemo {
    const chatId = developmentChatDemoIds.demo;

    return {
        agentIds: [ottoId],
        chatId,
        title: 'Demo: Your Messages',
        messages: selfDemoTurns.flatMap((turn, index) => {
            const ids = selfDemoTurnIds(index);

            return [
                ownerMessage({
                    agentId: ottoId,
                    chatId,
                    content: turn.ask,
                    id: ids.requestMessageId,
                    nonce: `${ids.slug}-request`,
                }),
                assistantMessage({
                    agentId: ottoId,
                    chatId,
                    content: turn.reply,
                    id: ids.responseMessageId,
                    nonce: `${ids.slug}-response`,
                    requestMessageId: ids.requestMessageId,
                    runId: ids.runId,
                }),
            ];
        }),
    };
}

function selfDemoTurnIds(index: number) {
    const number = String(index + 1).padStart(2, '0');
    const slug = `demo-self-${number}`;

    return {
        requestMessageId: `msg_demo_self_${number}_request`,
        responseMessageId: `msg_demo_self_${number}_response`,
        runId: `run_demo_self_${number}`,
        slug,
    };
}
