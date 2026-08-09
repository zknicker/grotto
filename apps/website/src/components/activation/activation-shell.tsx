import type * as React from 'react';
import { cn } from '../../lib/utils.ts';
import { GrottoLogo } from '../grotto-logo.tsx';
import { AppShell, AppShellDragRegion } from '../ui/app-shell.tsx';
import './activation.css';

/**
 * ActivationShell — the one frame every signed-out and setup surface shares:
 * sign-in, Server choice and creation, invitations, Computer approval, and
 * Server onboarding. The Grotto mark and chrome stay put while steps change
 * beneath them, so consecutive screens read as one continuous flow.
 */
export function ActivationShell({
    children,
    end,
    progress,
}: {
    children: React.ReactNode;
    /** Quiet top-right actions such as Switch Server or review controls. */
    end?: React.ReactNode;
    /** Centered top progress signal for multi-step flows. */
    progress?: React.ReactNode;
}) {
    return (
        <AppShell>
            <AppShellDragRegion />
            <header className="activation-topbar">
                {progress ? <div className="activation-topbar__progress">{progress}</div> : null}
                {end}
            </header>
            <main className="activation-main">
                <div className="activation-column">
                    <GrottoLogo animated aria-hidden="true" className="activation-mark" />
                    {children}
                </div>
            </main>
        </AppShell>
    );
}

/** One activation screen: centered heading, optional content, centered actions. */
export function ActivationStep({
    children,
    className,
    description,
    footer,
    title,
}: {
    children?: React.ReactNode;
    className?: string;
    description?: React.ReactNode;
    footer?: React.ReactNode;
    title: string;
}) {
    return (
        <section className={cn('activation-step', className)}>
            <header className="activation-step__heading">
                <h1 className="text-balance font-semibold text-2xl text-foreground tracking-tight">
                    {title}
                </h1>
                {description ? (
                    <p className="mx-auto max-w-sm text-pretty text-muted text-sm">{description}</p>
                ) : null}
            </header>
            {children ? <div className="activation-step__content">{children}</div> : null}
            {footer ? <footer className="activation-step__footer">{footer}</footer> : null}
        </section>
    );
}
