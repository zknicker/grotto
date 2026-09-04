import { ArrowUpRight01Icon } from '@hugeicons-pro/core-stroke-rounded';
import { Link, useParams } from 'react-router-dom';
import { Icon } from '../../../components/ui/icon.tsx';
import { settingsAgentRoute } from '../../servers/server-routes.ts';

/**
 * Out of the transcript and into the automation itself. The owning Agent's
 * Automations tab is the one place a Trigger or Reminder can be edited,
 * disabled, or read fire-by-fire, so both provenance surfaces point there and
 * neither tries to be an editor.
 */
export function ManageInAutomationsLink({ agentId }: { agentId: string }) {
    const { slug = '' } = useParams();

    return (
        <Link
            className="inline-flex w-fit items-center gap-1 font-semibold text-accent text-xs"
            to={settingsAgentRoute(slug, agentId, 'automations')}
        >
            Manage in Automations
            <Icon aria-hidden="true" icon={ArrowUpRight01Icon} size={11} />
        </Link>
    );
}
