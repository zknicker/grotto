import { FileEmpty02Icon } from '@hugeicons-pro/core-stroke-rounded';
import type * as React from 'react';
import { WikiMarkdownViewer } from '../../components/markdown/markdown-viewer.tsx';
import { Badge } from '../../components/ui/badge.tsx';
import { Icon } from '../../components/ui/icon.tsx';
import { Spinner } from '../../components/ui/spinner.tsx';
import { useSkillEnabledSet } from '../../hooks/skills/use-skill-enabled-set.ts';
import { useSkillHubPreview } from '../../hooks/skills/use-skill-hub-preview.ts';
import { useSkillHubScan } from '../../hooks/skills/use-skill-hub-scan.ts';
import { useSkillPreview } from '../../hooks/skills/use-skill-preview.ts';
import { SkillDetailActions, type SkillEnablementController } from './skill-detail-actions.tsx';
import { formatSkillName } from './skill-name-format.ts';
import {
    formatSkillPreviewDate,
    getSkillCreator,
    mergeKeywords,
    parseSkillMarkdownMetadata,
    stripFrontmatter,
} from './skill-preview-metadata.ts';
import type { SkillTreeSubject } from './skill-tree-model.ts';

export type { SkillEnablementController };

export function SkillPreviewPane({
    skillEnablement,
    subject,
}: {
    skillEnablement?: SkillEnablementController;
    subject: null | SkillTreeSubject;
}) {
    if (!subject) {
        return <SkillPreviewEmpty detail="Select a SKILL.md file from the skills tree." />;
    }

    return (
        <SelectedSkillPreview
            key={subject.treePath}
            skillEnablement={skillEnablement}
            subject={subject}
        />
    );
}

function SelectedSkillPreview({
    skillEnablement,
    subject,
}: {
    skillEnablement?: SkillEnablementController;
    subject: SkillTreeSubject;
}) {
    const defaultSkillEnablement = useSkillEnabledSet();
    const setEnabled: SkillEnablementController = skillEnablement ?? {
        error: defaultSkillEnablement.error,
        isPending: defaultSkillEnablement.isPending,
        mutate: defaultSkillEnablement.mutate,
    };
    const hasInstalledSourcePreview = Boolean(subject.installed && subject.skillId);
    const installedPreview = useSkillPreview({
        skillId: hasInstalledSourcePreview ? subject.skillId : null,
    });
    const hubPreview = useSkillHubPreview({
        identifier: subject.installed ? null : subject.identifier,
    });
    const scanQuery = useSkillHubScan({
        identifier: subject.installed ? null : subject.identifier,
    });
    const scanBlocked = scanQuery.data?.policy === 'block';
    const mutationError = setEnabled.error;
    const rawMarkdown = installedPreview.data?.contentMarkdown ?? hubPreview.data?.skillMd ?? '';
    const markdownMetadata = parseSkillMarkdownMetadata(rawMarkdown);
    const markdown = stripFrontmatter(rawMarkdown);
    const keywords = mergeKeywords(markdownMetadata.keywords, hubPreview.data?.tags ?? []);
    const isLoading =
        (installedPreview.isPending && hasInstalledSourcePreview && subject.skillId) ||
        (hubPreview.isPending && !subject.installed && subject.identifier);
    const previewError = installedPreview.error ?? hubPreview.error;

    return (
        <div className="flex h-full min-h-0 flex-col bg-background">
            <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-3 pt-4 pb-3">
                <header className="px-2">
                    <div className="flex items-start gap-3">
                        <div className="flex min-w-0 flex-1 items-center gap-2">
                            <h2 className="truncate font-semibold text-foreground text-xl leading-tight">
                                {formatSkillName(subject.name)}
                            </h2>
                            {subject.updateAvailable ? (
                                <Badge size="sm" variant="info">
                                    Update available
                                </Badge>
                            ) : null}
                        </div>
                        <SkillDetailActions
                            scanBlocked={scanBlocked}
                            setEnabled={setEnabled}
                            subject={subject}
                        />
                    </div>
                    <SkillDetailSummary
                        createdBy={markdownMetadata.createdBy ?? getSkillCreator(subject)}
                        description={subject.description}
                        keywords={keywords}
                        source={formatSkillSource(subject)}
                        updatedAt={subject.updatedAt}
                    />
                    {mutationError ? (
                        <p className="mt-3 text-error text-sm">{mutationError.message}</p>
                    ) : null}
                </header>

                <SkillMarkdownPreview
                    error={previewError?.message ?? null}
                    isLoading={Boolean(isLoading)}
                    markdown={markdown}
                />
            </div>
        </div>
    );
}

function SkillDetailSummary({
    createdBy,
    description,
    keywords,
    source,
    updatedAt,
}: {
    createdBy: string;
    description: null | string;
    keywords: string[];
    source: string;
    updatedAt: null | string;
}) {
    return (
        <div className="mt-6">
            <div className="grid grid-cols-[max-content_max-content_max-content] gap-x-10 gap-y-1">
                <span className="font-semibold text-muted-foreground text-sm">Created by</span>
                <span className="font-semibold text-muted-foreground text-sm">Last updated at</span>
                <span className="font-semibold text-muted-foreground text-sm">Source</span>
                <span className="text-foreground text-sm leading-5">{createdBy}</span>
                <span className="text-foreground text-sm leading-5">
                    {formatSkillPreviewDate(updatedAt)}
                </span>
                <span className="text-foreground text-sm leading-5">{source}</span>
            </div>
            {description ? (
                <div className="mt-4 max-w-[48rem]">
                    <p className="font-semibold text-muted-foreground text-sm">Description</p>
                    <p className="mt-1 text-foreground text-sm leading-5">{description}</p>
                </div>
            ) : null}
            {keywords.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-1.5">
                    {keywords.slice(0, 8).map((keyword) => (
                        <span
                            className="inline-flex h-6 items-center rounded-md border border-border/70 bg-muted/20 px-2 text-muted-foreground text-sm leading-none"
                            key={keyword}
                        >
                            Keyword&nbsp;
                            <strong className="font-semibold text-foreground">{keyword}</strong>
                        </span>
                    ))}
                </div>
            ) : null}
        </div>
    );
}

function formatSkillSource(subject: SkillTreeSubject) {
    if (subject.managedSource === 'seeded') {
        return 'Grotto default';
    }
    if (subject.managedSource === 'hub') {
        return 'Library';
    }
    return 'Custom';
}

function SkillMarkdownPreview({
    error,
    isLoading,
    markdown,
}: {
    error: null | string;
    isLoading: boolean;
    markdown: string;
}) {
    if (isLoading) {
        return (
            <SkillPreviewState>
                <Spinner className="size-5" />
            </SkillPreviewState>
        );
    }
    if (error) {
        return (
            <SkillPreviewState>
                <p className="px-8 text-center text-error text-sm">{error}</p>
            </SkillPreviewState>
        );
    }
    if (markdown.trim().length === 0) {
        return <SkillPreviewEmpty detail="No SKILL.md content is available for this skill." />;
    }
    return (
        <article className="mt-5 min-w-0 rounded-xl border border-border/70 bg-card px-9 py-7 [&_>div]:text-base [&_>div]:leading-7 [&_a]:break-all [&_blockquote]:break-words [&_h1]:mb-4 [&_h1]:text-[1.25rem] [&_h1]:leading-7 [&_h1]:tracking-normal [&_h2]:mt-7 [&_h2]:mb-3 [&_h2]:text-[1.0625rem] [&_h2]:leading-6 [&_h3]:text-base [&_li]:break-words [&_p]:my-4 [&_p]:break-words [&_pre]:rounded-lg [&_pre]:border [&_pre]:border-border/60 [&_pre]:bg-background [&_pre]:px-4 [&_pre]:py-3">
            <WikiMarkdownViewer value={markdown} />
        </article>
    );
}

function SkillPreviewState({ children }: { children: React.ReactNode }) {
    return <div className="grid h-full min-h-[28rem] place-items-center">{children}</div>;
}

function SkillPreviewEmpty({ detail }: { detail: string }) {
    return (
        <SkillPreviewState>
            <div className="grid justify-items-center gap-3 px-8 text-center">
                <span className="flex size-12 items-center justify-center rounded-full border border-border/60 bg-muted/30 text-muted-foreground">
                    <Icon className="size-6" icon={FileEmpty02Icon} />
                </span>
                <p className="font-medium text-foreground text-sm">No preview</p>
                <p className="max-w-sm text-muted-foreground text-sm">{detail}</p>
            </div>
        </SkillPreviewState>
    );
}
