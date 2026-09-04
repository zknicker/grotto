import { useSearchParams } from 'react-router-dom';

/**
 * The one piece of Inbox state the URL owns: which Ask is peeked open.
 * `?ask=<messageId>` makes the open Ask a deep link, and Back closes it —
 * the same contract `?task=` gives the Tasks page.
 */
export function useInboxView() {
    const [searchParams, setSearchParams] = useSearchParams();

    return {
        // Close replaces so Back from a closed dialog leaves the page; open
        // pushes an entry so Back closes an open dialog.
        closeAsk: () => {
            setSearchParams(
                (params) => {
                    const next = new URLSearchParams(params);
                    next.delete('ask');
                    return next;
                },
                { replace: true }
            );
        },
        openAsk: (messageId: string) => {
            setSearchParams((params) => {
                const next = new URLSearchParams(params);
                next.set('ask', messageId);
                return next;
            });
        },
        openAskId: searchParams.get('ask'),
    };
}
