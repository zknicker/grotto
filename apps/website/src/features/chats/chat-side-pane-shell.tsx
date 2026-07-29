import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import * as React from 'react';
import { ResizablePaneRail } from '../../components/ui/resizable-pane-rail.tsx';
import {
    artifactPaneWidthLimits,
    useArtifactPaneWidth,
} from '../../hooks/pane/use-artifact-pane-width.ts';
import { cn } from '../../lib/utils.ts';

export function ChatSidePaneShell({
    children,
    label,
    open,
    takeover = false,
}: {
    children: (width: number | null) => React.ReactNode;
    label: string;
    open: boolean;
    takeover?: boolean;
}) {
    const shouldReduceMotion = useReducedMotion();
    const [resizing, setResizing] = React.useState(false);
    const paneWidth = useArtifactPaneWidth();

    return (
        <AnimatePresence initial={false}>
            {open ? (
                <motion.aside
                    animate={
                        takeover
                            ? { opacity: 1, x: 0 }
                            : { opacity: 1, width: paneWidth.width, x: 0 }
                    }
                    aria-label={label}
                    className={cn(
                        'relative flex h-full min-h-0 overflow-hidden bg-background',
                        takeover
                            ? 'min-w-0 flex-1'
                            : 'z-[36] shrink-0 border-[var(--content-card-border)] border-l'
                    )}
                    exit={takeover ? { opacity: 0, x: 18 } : { opacity: 0, width: 0, x: 36 }}
                    initial={
                        shouldReduceMotion
                            ? false
                            : takeover
                              ? { opacity: 0, x: 18 }
                              : { opacity: 0, width: 0, x: 36 }
                    }
                    transition={
                        shouldReduceMotion
                            ? { duration: 0.12 }
                            : {
                                  opacity: { duration: 0.28, ease: [0.16, 1, 0.3, 1] },
                                  width: {
                                      duration: resizing ? 0 : 0.28,
                                      ease: [0.16, 1, 0.3, 1],
                                  },
                                  x: { duration: 0.28, ease: [0.16, 1, 0.3, 1] },
                              }
                    }
                >
                    {takeover ? null : (
                        <ResizablePaneRail
                            maxWidth={artifactPaneWidthLimits.max}
                            minWidth={artifactPaneWidthLimits.min}
                            onResizeEnd={() => setResizing(false)}
                            onResizeStart={() => setResizing(true)}
                            onWidthChange={paneWidth.setWidth}
                            onWidthCommit={paneWidth.persistWidth}
                            side="left"
                            width={paneWidth.width}
                        />
                    )}
                    {children(takeover ? null : paneWidth.width)}
                </motion.aside>
            ) : null}
        </AnimatePresence>
    );
}
