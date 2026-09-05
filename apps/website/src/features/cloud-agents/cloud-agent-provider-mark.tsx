import type { CloudAgentProvider } from '@grotto/api';
import { CloudIcon } from '@hugeicons-pro/core-stroke-rounded';
import { ModelProviderLogo } from '../../components/badges/model-provider-logo.tsx';
import { identityMarkRadius } from '../../components/ui/entity-avatar.tsx';
import { cn } from '../../lib/utils.ts';
import { cloudAgentProviderPresentation } from './cloud-agent-provider-presentation.ts';

/**
 * The provider's own mark at card scale: the same 48px box every `ActionCard`
 * identity uses, with the radius derived from that box rather than fixed, so
 * the corner tracks the size the way `EntityAvatar` does.
 */
export function CloudAgentProviderMark({ provider }: { provider: CloudAgentProvider }) {
    const presentation = cloudAgentProviderPresentation[provider];

    return (
        <ModelProviderLogo
            className="size-12 border border-separator"
            color={presentation.color}
            fallbackIcon={CloudIcon}
            iconClassName="size-6"
            logo={presentation.logo}
            style={{ borderRadius: identityMarkRadius(48) }}
        />
    );
}

/**
 * The same mark inline, at annotation scale: the Thread-surface header, the
 * hoisted status, and the Inbox row all lead with it instead of a generic
 * cloud. No box here — inline it is a glyph among words.
 */
export function CloudAgentProviderGlyph({
    className,
    provider,
}: {
    className?: string;
    provider: CloudAgentProvider;
}) {
    const presentation = cloudAgentProviderPresentation[provider];

    return (
        <ModelProviderLogo
            className={cn('size-3.5', className)}
            color={presentation.color}
            fallbackIcon={CloudIcon}
            iconClassName="size-3.5"
            logo={presentation.logo}
            style={{ backgroundColor: 'transparent' }}
        />
    );
}
