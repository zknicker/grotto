import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import { parse } from 'yaml';

const openApiPath = fileURLToPath(new URL('../openapi.yaml', import.meta.url));

describe('Tavern OpenAPI contract', () => {
    const document = parse(readFileSync(openApiPath, 'utf8')) as {
        components?: { schemas?: Record<string, unknown> };
        info?: { title?: string };
        openapi?: string;
        paths?: Record<string, unknown>;
    };

    it('declares the Tavern API document', () => {
        expect(document.openapi).toBe('3.1.0');
        expect(document.info?.title).toBe('Tavern API');
    });

    it('contains the first chat and realtime API slice', () => {
        expect(Object.keys(document.paths ?? {})).toEqual([
            '/api/chats',
            '/api/chats/{chat_id}',
            '/api/chats/{chat_id}/threads',
            '/api/chats/{chat_id}/follow',
            '/api/chats/{chat_id}/messages',
            '/api/chats/{chat_id}/messages/search',
            '/api/chats/{chat_id}/timeline',
            '/api/chats/{chat_id}/responses/{response_id}/evidence',
            '/api/chats/{chat_id}/deliveries',
            '/api/chats/{chat_id}/responses',
            '/api/chats/{chat_id}/responses/{response_id}/activity',
            '/api/chats/{chat_id}/activity/{activity_id}',
            '/api/chats/{chat_id}/artifacts',
            '/api/chats/{chat_id}/read',
            '/api/chats/{chat_id}/clear',
            '/api/responses/{response_id}',
            '/api/messages/{message_id}',
            '/api/turns/{run_id}/prompt',
            '/api/turns/{run_id}/file-changes',
            '/api/agent/messages/send',
            '/api/agent/history',
            '/api/agent/manual/get',
            '/api/agent/manual/search',
            '/api/agent/messages/search',
            '/api/agent/messages/{id}',
            '/api/agent/server',
            '/api/agent/channels/info',
            '/api/agent/channels/members',
            '/api/agent/tasks',
            '/api/agent/tasks/create',
            '/api/agent/tasks/claim',
            '/api/agent/tasks/unclaim',
            '/api/agent/tasks/update',
            '/api/agent/reminders',
            '/api/agent/reminders/log',
            '/api/agent/reminders/schedule',
            '/api/agent/reminders/snooze',
            '/api/agent/reminders/update',
            '/api/agent/reminders/cancel',
            '/api/agent/attachments/upload',
            '/api/agent/attachments/{id}',
            '/api/agent/profile',
            '/api/agent/profile/update',
            '/api/agent/messages/react',
            '/api/agent/skills',
            '/api/agent/skills/{id}',
            '/api/agent/skills/create',
            '/api/agent/skills/patch',
            '/api/agent/skills/write-file',
            '/api/events',
            '/api/events/ws',
        ]);
    });

    it('defines durable chat identity schemas', () => {
        expect(document.components?.schemas).toHaveProperty('Chat');
        expect(document.components?.schemas).toHaveProperty('ChatMessage');
        expect(document.components?.schemas).toHaveProperty('ChatResponse');
        expect(document.components?.schemas).toHaveProperty('ResponseActivity');
        expect(document.components?.schemas).toHaveProperty('ChatArtifact');
        expect(document.components?.schemas).toHaveProperty('ChatEvent');
        expect(document.components?.schemas).toHaveProperty('ChatMessageReceipt');
        expect(document.components?.schemas).toHaveProperty('ThreadSummary');
        expect(document.components?.schemas).toHaveProperty('AgentSendResponse');
        expect(document.components?.schemas).toHaveProperty('AgentHistoryResponse');
        expect(document.components?.schemas).toHaveProperty('AgentManualTopic');
        expect(document.components?.schemas).toHaveProperty('AgentManualSearchResponse');
        expect(document.components?.schemas).toHaveProperty('AgentTaskRow');
        expect(document.components?.schemas).toHaveProperty('AgentReminder');
        expect(document.components?.schemas).toHaveProperty('AgentAttachment');
        expect(document.components?.schemas).toHaveProperty('AgentProfile');
        expect(document.components?.schemas).toHaveProperty('AgentReactionRequest');
        expect(document.components?.schemas).toHaveProperty('AgentSkillSummary');
    });

    it('maps agent send discriminator values to their response variants', () => {
        const response = document.components?.schemas?.AgentSendResponse as {
            discriminator?: { mapping?: Record<string, string>; propertyName?: string };
        };
        expect(response.discriminator).toEqual({
            mapping: {
                held: '#/components/schemas/AgentHeldMessage',
                sent: '#/components/schemas/AgentSentMessage',
            },
            propertyName: 'state',
        });
    });

    it('validates extended agent success payloads and rejects empty task claims', () => {
        const ajv = new Ajv2020({
            allowUnionTypes: true,
            formats: { byte: true },
            strictSchema: false,
        });
        const validate = (schema: string, payload: unknown) =>
            ajv.compile({
                $ref: `#/components/schemas/${schema}`,
                components: document.components,
            })(payload);

        expect(
            validate('AgentAttachmentViewResponse', {
                attachment: {
                    byteSize: 2,
                    dataBase64: 'aGk=',
                    filename: 'hello.txt',
                    id: 'att_1',
                    mediaType: 'text/plain',
                },
            })
        ).toBe(true);
        expect(
            validate('AgentSkillViewResponse', {
                content: '# Audit\n',
                description: 'Audit',
                editable: true,
                enabledForYou: true,
                hash: 'abc123',
                id: 'audit',
                name: 'audit',
                supportFiles: [{ hash: 'def456', path: 'references/checklist.md' }],
            })
        ).toBe(true);
        expect(validate('AgentTaskClaimRequest', { numbers: [], target: '#general' })).toBe(false);
    });
});
