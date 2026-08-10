import * as React from 'react';
import { cn } from '../lib/utils.ts';
import './grotto-logo.css';

/**
 * Layer geometry mirrors assets/mac-icon.icon: the blob layer sits at
 * scale 1.13 offset (12.76, -7.14) and the eyes layer at scale 1.29
 * offset (0, -21) on the 1024 canvas.
 */
const blobTransform = 'translate(120.26 104.63) scale(1.13)';
const eyesTransform = 'translate(328.57 364.29) scale(1.29)';
const glyphEyesTransform = 'translate(184.35 229.79) scale(1.1416)';

/** The full-color Grotto mark: the blob on its blue-gradient badge. */
export function GrottoLogo({
    animated = false,
    className,
    ...props
}: { animated?: boolean } & React.ComponentPropsWithoutRef<'svg'>) {
    const gradientId = React.useId();

    return (
        <svg
            className={cn('grotto-logo', animated && 'grotto-logo--animated', className)}
            viewBox="0 0 1024 1024"
            xmlns="http://www.w3.org/2000/svg"
            {...props}
        >
            <title>Grotto</title>
            <defs>
                <linearGradient
                    gradientUnits="objectBoundingBox"
                    id={gradientId}
                    x1="0"
                    x2="0"
                    y1="0"
                    y2="1"
                >
                    <stop offset="0" stopColor="#0038A5" />
                    <stop offset="1" stopColor="#00184A" />
                </linearGradient>
            </defs>
            <rect fill={`url(#${gradientId})`} height="1024" rx="232" width="1024" />
            <g className="grotto-logo__figure">
                <path d={grottoBlobPath} fill="#FFFFFF" transform={blobTransform} />
                <g transform={eyesTransform}>
                    <g className="grotto-logo__eye">
                        <rect fill="#000000" height="196.45" rx="52.73" width="105.46" />
                        <rect
                            fill="#FFFFFF"
                            height="56.79"
                            rx="18.61"
                            width="37.22"
                            x="43.25"
                            y="28.51"
                        />
                    </g>
                    <g className="grotto-logo__eye">
                        <rect fill="#000000" height="196.45" rx="52.73" width="105.46" x="178.93" />
                        <rect
                            fill="#FFFFFF"
                            height="56.79"
                            rx="18.61"
                            width="37.22"
                            x="222.18"
                            y="28.51"
                        />
                    </g>
                </g>
            </g>
        </svg>
    );
}

/** Monochrome blob silhouette (eyes knocked out) for small chrome like menus. */
export function GrottoGlyph({ className, ...props }: React.ComponentPropsWithoutRef<'svg'>) {
    const maskId = React.useId();

    return (
        <svg
            className={className}
            fill="none"
            viewBox="0 0 716 708"
            xmlns="http://www.w3.org/2000/svg"
            {...props}
        >
            <title>Grotto</title>
            <mask height="708" id={maskId} maskUnits="userSpaceOnUse" width="716" x="0" y="0">
                <rect fill="#FFFFFF" height="708" width="716" />
                <g fill="#000000" transform={glyphEyesTransform}>
                    <rect height="196.45" rx="52.73" width="105.46" />
                    <rect height="196.45" rx="52.73" width="105.46" x="178.93" />
                </g>
            </mask>
            <path d={grottoBlobPath} fill="currentColor" mask={`url(#${maskId})`} />
        </svg>
    );
}

const grottoBlobPath =
    'M 146.069 126.387 C 87.522 128.062 17.623 133.496 1.478 232.609 C -9.577 300.474 45.01 352.548 45.01 352.548 C 45.01 352.548 101.283 391.205 67.877 455.382 C 34.471 519.558 53.861 574.882 53.861 574.882 C 53.861 574.882 83.368 655.287 179.263 638.32 C 179.263 638.32 221.31 628.731 249.34 617.666 C 277.371 606.601 310.484 620.617 323.844 634.632 C 337.204 648.648 405.736 708.379 460.323 708.379 C 514.909 708.379 568.008 687.006 577.598 617.666 C 587.187 548.326 567.27 491.527 613.743 462.758 C 660.215 433.99 721.441 359.486 715.539 316.702 C 709.638 273.918 689.512 226.691 599.727 200.152 C 518.969 176.282 483.792 82.192 483.792 82.192 C 483.792 82.192 461.904 -3.939 377.771 0.14 C 377.771 0.14 310.456 0.092 269.08 66.108 C 242.206 108.986 204.615 124.712 146.069 126.387 Z';
