import { expect, test } from 'bun:test';
import { getManualTopic, searchManualTopics } from './index.ts';

test('publishes the Agent reference topic as the Agent-creation contract', () => {
    const agent = getManualTopic('agent');

    expect(getManualTopic('recipes/playbook/agent-creation')).toBeNull();
    expect(getManualTopic('action-cards')).toBeNull();
    expect(agent?.kind).toBe('overview');
    expect(agent?.body).toContain(
        'grotto agent create --target <target> --name <name> --description <text> [--brief <text>] [--channel "#name"] [--avatar-concept <text>] --say <text>'
    );
    expect(agent?.body).toContain(
        'Create an Agent only when a human in the Chat you are working in has asked for one'
    );
    expect(agent?.body).toContain('never create one to split work you could do yourself');
    expect(agent?.body).toContain('inherits your runtime, model, reasoning effort, and Computer');
    expect(agent?.body).toContain(
        'The identical command returns the teammate the first run created and creates nothing new'
    );
    expect(agent?.body).toContain('Name them by `@handle`');
    expect(agent?.body).toContain('the refusal names the handle the Server minted instead');
    expect(agent?.body).not.toMatch(/Created @handle|Open control/u);
    expect(agent?.body).toContain('the Agent is created without one and the receipt says so');
    // Where the announcement goes, where the Agent lives, and the standing brief
    // that replaced the follow-up DM.
    expect(agent?.body).toContain('**Announce it in #all.**');
    expect(agent?.body).toContain('**Put it where the work is.**');
    expect(agent?.body).toContain('**Give it a brief.**');
    expect(agent?.body).toContain('you do not DM the new Agent');
    expect(agent?.body).toContain('grotto channel add --target "#name" --agent @handle');
    expect(agent?.body).not.toContain('grotto message send --target dm:@handle');
    expect(agent?.body).toContain('grotto agent update --agent @handle --description <text>');
    expect(agent?.body).toContain('grotto agent avatar --agent @handle --concept <text>');
    expect(agent?.body).toContain("Cove's identity is protected");
    expect(agent?.body).toContain('The Agent profile pane in Grotto App');
    expect(agent?.body).not.toMatch(/action card|grotto action prepare|Server role/iu);
    expect(
        searchManualTopics('create a new agent', { limit: 5, scope: 'all' }).map(
            (topic) => topic.id
        )
    ).toContain('agent');
});

test('publishes the Ask reference topic without turning it into a procedure', () => {
    const asks = getManualTopic('asks');

    expect(asks?.kind).toBe('overview');
    expect(asks?.body).toContain(
        'grotto ask --target <target> --to @<handle> --title <text> --summary <text> --step <text>'
    );
    expect(asks?.body).toContain('one named human for a decision');
    expect(asks?.body).toContain('The question text arrives on stdin');
    expect(asks?.body).toContain('settles the Ask');
    expect(asks?.body).toContain('An Ask changes nothing on its own');
    expect(getManualTopic('grotto-cli-overview')?.body).toContain('grotto ask');
    expect(
        searchManualTopics('ask a human for a decision', { limit: 5, scope: 'all' }).map(
            (topic) => topic.id
        )
    ).toContain('asks');
});
