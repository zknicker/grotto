import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { HostedAgentFace } from './hosted-agent-face.tsx';

test('renders the persisted hosted Agent character', () => {
    const markup = renderToStaticMarkup(
        <HostedAgentFace agent={{ character: 'blob' }} animate={false} size={32} />
    );

    expect(markup).toContain('aria-label="blob agent, default"');
    expect(markup).not.toContain('aria-label="knight agent, default"');
});
