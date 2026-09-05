import type { CloudAgentBranch, CloudAgentWork } from '@grotto/api';
import { Button, Chip, toast } from '@heroui/react';
import {
    ArrowUpRight01Icon,
    CloudIcon,
    GitBranchIcon,
    GitPullRequestIcon,
} from '@hugeicons-pro/core-stroke-rounded';
import { ActionCard, ActionCardGlyphMark } from '../../components/chats/action-card.tsx';
import { useRelativeNow } from '../../components/time/relative-time.tsx';
import { Icon } from '../../components/ui/icon.tsx';
import { formatRelativeTime, formatShortTime } from '../../lib/format.ts';
import { openExternalLink } from '../../lib/open-external-link.ts';
import { useTranscriptRenderContextOptional } from '../chats/chat-transcript-render-context.tsx';
import {
    cloudAgentPresentationStatus,
    cloudAgentProviderLabels,
    cloudAgentStatusChipColor,
    cloudAgentStatusText,
    cloudAgentWorkBranch,
    cloudAgentWorkDetailLine,
    isCloudAgentWorkStale,
    pullRequestNumber,
} from './cloud-agent-presentation.ts';
import { CloudAgentStatusDisc } from './cloud-agent-status-disc.tsx';
import { useCloudAgentCancelAction } from './use-cloud-agent-cancel-action.ts';

/**
 * The Cloud Agent work as it reads inside its Thread: the Agent says what it
 * delegated in its own Message, and this card states the run itself, in
 * sequence directly beneath. It is presentation of the Server-owned work
 * record, never a Chat row of its own — nothing here has an id, an author, or
 * a place in the sequence except the Message above it.
 *
 * The card is the whole account: what is running, where, what it produced, and
 * the three things a human can do about it. That is why the Thread pane carries
 * no separate work panel — the panel and this card said the same facts twice,
 * and only one of them sits where the work actually happened.
 */
export function CloudAgentWorkCard({ work }: { work: CloudAgentWork }) {
    const now = useRelativeNow(work.terminalAt ? 60_000 : 5000);
    const cancel = useCloudAgentCancelAction(work);
    const resolve = useTranscriptRenderContextOptional()?.resolveActorProfile;
    const status = cloudAgentPresentationStatus(work);
    const statusText = cloudAgentStatusText(work, now);
    const providerLabel = cloudAgentProviderLabels[work.provider];
    const branch = cloudAgentWorkBranch(work);
    const pullRequestUrl = branch?.pullRequestUrl ?? null;
    const providerUrl = work.providerUrl;
    // Progress is worth a glyph; a settled run already says so in one word and
    // in the chip's own color.
    const inProgress = status === 'queued' || status === 'running' || status === 'cancelling';
    const report = cloudAgentWorkDetailLine(work);
    const stale = isCloudAgentWorkStale(work, now);
    const delegatedBy = resolve?.({ id: work.agentId, kind: 'agent' })?.name ?? null;

    return (
        <ActionCard
            actionKind="cloud-agent-work"
            actionStatus={work.status}
            aria-label={`Cloud Agent work: ${work.title}`}
            data-testid="cloud-agent-work-card"
        >
            <ActionCard.Header>
                <ActionCard.Mark>
                    <ActionCardGlyphMark icon={CloudIcon} />
                </ActionCard.Mark>
                <ActionCard.Content>
                    <ActionCard.Title>
                        {work.title}
                        <ActionCard.Status>
                            <Chip
                                color={cloudAgentStatusChipColor(status)}
                                size="sm"
                                variant="soft"
                            >
                                {inProgress ? (
                                    <CloudAgentStatusDisc
                                        className="size-3 text-current"
                                        status={status}
                                    />
                                ) : null}
                                <Chip.Label>{statusText}</Chip.Label>
                            </Chip>
                        </ActionCard.Status>
                    </ActionCard.Title>
                    <ActionCard.Description>
                        {providerLabel} · {work.repository}
                    </ActionCard.Description>
                </ActionCard.Content>
            </ActionCard.Header>
            {/* The repository is stated once, above. This row is the Git fact
                the run produced: the branch it wrote, and the pull request that
                branch opened — the part a reader is actually here for, so the
                branch gives way before the PR number does. */}
            <ActionCard.Meta>
                <Icon aria-hidden="true" icon={GitBranchIcon} />
                {branchLabel(branch, work.repository, work.startingRef)}
                {pullRequestUrl ? (
                    <span data-testid="cloud-agent-work-pull-request">
                        {' · '}
                        {pullRequestLabel(pullRequestUrl)}
                    </span>
                ) : null}
            </ActionCard.Meta>
            {report || stale ? (
                <ActionCard.Meta data-testid="cloud-agent-work-report">
                    {report}
                    {report && stale ? <span aria-hidden="true"> · </span> : null}
                    {stale ? `Last update ${formatRelativeTime(work.updatedAt, now)}` : null}
                </ActionCard.Meta>
            ) : null}
            <ActionCard.Actions>
                {pullRequestUrl ? (
                    <Button
                        onPress={() => openLink(pullRequestUrl, 'the pull request')}
                        size="sm"
                        variant="secondary"
                    >
                        <Icon icon={GitPullRequestIcon} size={16} />
                        View PR
                    </Button>
                ) : null}
                {providerUrl ? (
                    <Button
                        onPress={() => openLink(providerUrl, providerLabel)}
                        size="sm"
                        variant="tertiary"
                    >
                        <Icon icon={ArrowUpRight01Icon} size={16} />
                        Open in {providerLabel}
                    </Button>
                ) : null}
                {cancel.canCancel ? (
                    <Button
                        isDisabled={cancel.isPending}
                        onPress={cancel.requestCancel}
                        size="sm"
                        variant="danger-soft"
                    >
                        Cancel run
                    </Button>
                ) : null}
                {delegatedBy ? (
                    <ActionCard.Receipt>
                        Delegated by {delegatedBy} · {formatShortTime(work.createdAt)}
                    </ActionCard.Receipt>
                ) : null}
            </ActionCard.Actions>
        </ActionCard>
    );
}

/**
 * The branch fact, without repeating the repository the card already names. A
 * provider reporting a branch in some other repository — a fork, or a host that
 * qualifies its names — keeps that repository, because there it is the point.
 * Before any branch exists, the ref the run started from is the only one there
 * is, and says so.
 */
function branchLabel(
    branch: CloudAgentBranch | null,
    repository: string,
    startingRef: null | string
): string {
    if (!branch) {
        return startingRef ? `from ${startingRef}` : 'No branch yet';
    }
    return branch.repository === repository
        ? branch.branch
        : `${branch.repository} · ${branch.branch}`;
}

/** `PR #482` when the provider's URL names one, and the bare word when it does not. */
function pullRequestLabel(pullRequestUrl: string): string {
    const number = pullRequestNumber(pullRequestUrl);
    return number === null ? 'Pull request' : `PR #${number}`;
}

function openLink(url: string, what: string) {
    openExternalLink(url).catch(() => toast.danger(`Could not open ${what}`));
}
