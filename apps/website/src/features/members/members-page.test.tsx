import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { MembersPageFrame } from './members-page.tsx';

test('an unavailable Agent directory is not presented as an empty directory', () => {
    const markup = renderToStaticMarkup(
        <MembersPageFrame
            agentCount={0}
            agentListStatus="error"
            agentRows={null}
            detail={null}
            humanMembers={null}
        />
    );

    expect(markup).not.toContain('Agents</span><span class="tabular-nums">0');
    expect(markup).toContain('Couldn’t load Agents');
});
