import { describe, expect, test } from 'bun:test';
import {
    resolveActiveSection,
    resolveSelectedChatId,
    resolveSettingsSection,
} from './server-route-state.ts';

describe('Server route state', () => {
    test('treats removed overview routes as Chat entry paths', () => {
        expect(resolveActiveSection('/s/dev/activity', 'dev')).toBe('chat');
        expect(resolveActiveSection('/s/dev/design/brief', 'dev')).toBe('chat');
    });

    test('reads the selected Chat and settings section from the current Server path', () => {
        expect(resolveSelectedChatId('/s/dev/chats/chat%2Fone', 'dev')).toBe('chat/one');
        expect(resolveSettingsSection('/s/dev/settings/appearance', 'dev')).toBe('appearance');
    });
});
