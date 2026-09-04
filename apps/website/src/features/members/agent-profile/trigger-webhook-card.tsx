import { Alert } from '@heroui/react';
import { CodeBlock } from '@heroui-pro/react/code-block';

/** What a mint hands back once: where to POST, the bearer secret, and a ready call. */
export interface TriggerSecretReveal {
    curl: string;
    secret: string;
    url: string;
}

/**
 * A reveal bound to the Trigger it was minted for, and to why it was minted —
 * the two facts the drawer needs to know whose secret it is holding and what to
 * warn about.
 */
export interface TriggerMintedSecret extends TriggerSecretReveal {
    minted: 'created' | 'rotated';
    triggerId: string;
}

/**
 * One copyable value. The header carries its name and the stock copy button,
 * which is the only confirmation a copy needs.
 */
export function TriggerValueBlock({
    code,
    label,
    language = 'plaintext',
}: {
    code: string;
    label: string;
    language?: string;
}) {
    return (
        // A URL, a secret, and a curl line are all one unbroken token, which
        // grows a grid item past its drawer unless the block is allowed to
        // shrink and scroll its own code instead.
        <CodeBlock className="min-w-0">
            <CodeBlock.Header>
                <span className="text-muted text-sm">{label}</span>
                <CodeBlock.CopyButton aria-label={`Copy ${label}`} code={code} />
            </CodeBlock.Header>
            <CodeBlock.Code className="overflow-x-auto" code={code} language={language} />
        </CodeBlock>
    );
}

/**
 * The secret exists in exactly one response and is never readable again, so
 * this card leads with that fact before the values it is about to show. It is
 * pinned at the top of the drawer body by whichever mint produced it, and it
 * goes away with the drawer.
 */
export function TriggerWebhookCard({ secret }: { secret: TriggerMintedSecret }) {
    return (
        <div className="grid gap-4">
            <Alert status="warning">
                <Alert.Indicator />
                <Alert.Content>
                    <Alert.Title>Copy the secret now</Alert.Title>
                    <Alert.Description>
                        {secret.minted === 'rotated'
                            ? 'It is shown only this once, and the previous secret has stopped working.'
                            : 'It is shown only this once. Rotate the trigger to mint a new one if it leaks.'}
                    </Alert.Description>
                </Alert.Content>
            </Alert>
            <TriggerValueBlock code={secret.url} label="URL" />
            <TriggerValueBlock code={secret.secret} label="Secret" />
            <TriggerValueBlock code={secret.curl} label="curl" language="shellscript" />
        </div>
    );
}
