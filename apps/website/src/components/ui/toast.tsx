'use client';

import { Toast as ToastPrimitive } from '@base-ui/react/toast';
import type { IconSvgElement } from '@hugeicons/react';
import {
    Alert02SolidRounded,
    AlertCircleSolidRounded,
    CheckmarkCircle02SolidRounded,
    InformationCircleSolidRounded,
} from '@hugeicons-pro/core-solid-rounded';
import type * as React from 'react';
import { cn } from '../../lib/utils.ts';
import { Icon } from './icon.tsx';
import { Spinner } from './spinner.tsx';

type ToastType = 'default' | 'error' | 'info' | 'loading' | 'success' | 'warning';
interface ToastData {
    type?: ToastType;
}

export const toastManager = ToastPrimitive.createToastManager<ToastData>();

export function ToastProvider({ children }: { children: React.ReactNode }) {
    return (
        <ToastPrimitive.Provider limit={3} timeout={4000} toastManager={toastManager}>
            {children}
            <ToastViewport />
        </ToastPrimitive.Provider>
    );
}

const toastIcons: Partial<Record<ToastType, { className: string; icon: IconSvgElement }>> = {
    error: { className: 'text-error-foreground', icon: AlertCircleSolidRounded },
    info: { className: 'text-muted-foreground', icon: InformationCircleSolidRounded },
    success: { className: 'text-legacy-success-foreground', icon: CheckmarkCircle02SolidRounded },
    warning: { className: 'text-legacy-warning-foreground', icon: Alert02SolidRounded },
};

function ToastViewport() {
    const manager = ToastPrimitive.useToastManager<ToastData>();

    return (
        <ToastPrimitive.Portal>
            <ToastPrimitive.Viewport
                className="fixed right-4 bottom-4 z-[100] flex w-[min(26rem,calc(100vw-2rem))] flex-col items-end gap-2 outline-none"
                data-slot="toast-viewport"
            >
                {manager.toasts.map((toast) => (
                    <ToastPrimitive.Root
                        className="w-fit max-w-full rounded-lg border border-border/60 bg-popover/70 px-3 py-2 text-popover-foreground shadow-black/15 shadow-lg outline-none backdrop-blur-xl backdrop-saturate-150 transition-[opacity,transform] duration-150 data-ending-style:translate-y-1 data-starting-style:translate-y-1 data-ending-style:opacity-0 data-starting-style:opacity-0"
                        key={toast.id}
                        toast={toast}
                    >
                        <ToastPrimitive.Content className="flex min-w-0 items-center gap-2">
                            <ToastIcon type={toast.type} />
                            {toast.title ? (
                                <ToastPrimitive.Title className="shrink-0 truncate font-medium text-sm leading-5">
                                    {toast.title}
                                </ToastPrimitive.Title>
                            ) : null}
                            {toast.description ? (
                                <ToastPrimitive.Description className="truncate text-muted-foreground text-sm leading-5">
                                    {toast.description}
                                </ToastPrimitive.Description>
                            ) : null}
                        </ToastPrimitive.Content>
                    </ToastPrimitive.Root>
                ))}
            </ToastPrimitive.Viewport>
        </ToastPrimitive.Portal>
    );
}

function ToastIcon({ type }: { type?: string }) {
    if (type === 'loading') {
        return <Spinner className="shrink-0 text-muted-foreground" />;
    }

    const accent = type ? toastIcons[type as ToastType] : undefined;

    if (!accent) {
        return null;
    }

    return <Icon className={cn('size-4 shrink-0', accent.className)} icon={accent.icon} />;
}
