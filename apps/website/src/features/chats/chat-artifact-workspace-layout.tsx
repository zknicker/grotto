import type { ReactNode } from 'react';
import type { WorkspaceArtifact } from './chat-artifact-workspace-file.tsx';
import {
    WorkspaceArtifactContent,
    WorkspaceArtifactEmpty,
} from './chat-artifact-workspace-preview.tsx';

export function WorkspaceBrowserPreview({
    agentId,
    directoryLoadError,
    artifact,
    controls,
    selectedPath,
}: {
    agentId: string;
    artifact: WorkspaceArtifact;
    controls?: ReactNode;
    directoryLoadError: null | string;
    selectedPath: null | string;
}) {
    return (
        <section className="h-full min-h-0 min-w-0 overflow-hidden">
            {selectedPath ? (
                <WorkspaceArtifactContent
                    agentId={agentId}
                    artifact={artifact}
                    controls={controls}
                    target={{ kind: 'workspaceFile', path: selectedPath }}
                />
            ) : (
                <WorkspaceArtifactEmpty
                    detail={
                        directoryLoadError ??
                        'Select a Markdown, HTML, image, or text file from the workspace sidebar.'
                    }
                    title="No file selected"
                />
            )}
        </section>
    );
}

export function WorkspaceBrowserFrame({
    fileRail,
    pageToolbar,
    preview,
    railWidth,
    treeAtStart,
}: {
    fileRail: ReactNode;
    pageToolbar?: ReactNode;
    preview: ReactNode;
    railWidth: number;
    treeAtStart: boolean;
}) {
    return (
        <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background">
            {pageToolbar}
            <div
                className="grid min-h-0 flex-1 overflow-hidden"
                style={{
                    gridTemplateColumns: treeAtStart
                        ? `${railWidth}px minmax(0, 1fr)`
                        : `minmax(0, 1fr) ${railWidth}px`,
                }}
            >
                {treeAtStart ? fileRail : preview}
                {treeAtStart ? preview : fileRail}
            </div>
        </div>
    );
}
