import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { MessageAskMarker } from './message-ask-marker.tsx';

const addresseeProfile = { avatarUrl: null, name: 'Zach' };

test('an open Ask marker names its addressee and keeps its status for readers', () => {
    const html = renderToStaticMarkup(
        <MessageAskMarker addresseeProfile={addresseeProfile} answeredByName={null} status="open" />
    );

    expect(html).toContain('Ask');
    expect(html).toContain('Zach');
    expect(html).toContain('sr-only">Open<');
});

test('an answered Ask marker states who answered it', () => {
    const html = renderToStaticMarkup(
        <MessageAskMarker
            addresseeProfile={addresseeProfile}
            answeredByName="Blippy"
            status="answered"
        />
    );

    expect(html).toContain('Answered by Blippy');
    expect(html).not.toContain('sr-only');
});
