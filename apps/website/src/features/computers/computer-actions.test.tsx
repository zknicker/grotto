import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { ComputerRemovalAction } from './computer-actions.tsx';

test('Computer removal stays disabled while an Agent remains assigned', () => {
    const html = renderToStaticMarkup(
        <ComputerRemovalAction
            availability={{ agentNames: ['Cove'], status: 'blocked' }}
            onRemove={() => undefined}
        />
    );

    expect(html).toContain('Delete Cove before removing this Computer.');
    expect(html).toContain('disabled=""');
});

test('Computer removal becomes available after every Agent is deleted', () => {
    const html = renderToStaticMarkup(
        <ComputerRemovalAction availability={{ status: 'ready' }} onRemove={() => undefined} />
    );

    expect(html).toContain('This immediately revokes this Computer’s credential.');
    expect(html).not.toContain('disabled=""');
});
