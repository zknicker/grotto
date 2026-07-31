'use client';

import { mergeProps } from '@base-ui/react/merge-props';
import { Select as SelectPrimitive } from '@base-ui/react/select';
import { useRender } from '@base-ui/react/use-render';
import { ChevronDoubleCloseIcon, Tick02Icon } from '@hugeicons-pro/core-solid-rounded';
import { cva, type VariantProps } from 'class-variance-authority';
import { AnimatePresence, motion } from 'framer-motion';
import * as React from 'react';
import {
    type ChangeEvent,
    Children,
    isValidElement,
    type ReactNode,
    type SelectHTMLAttributes,
} from 'react';
import { useProximityHover } from '../../hooks/use-proximity-hover.ts';
import { springs } from '../../lib/springs.ts';
import { cn } from '../../lib/utils.ts';
import { Icon } from './icon.tsx';
import { ScrollEdgeCue, useScrollEdges } from './scroll-area.tsx';
import { Elevated } from './surface.tsx';

export const Select: typeof SelectPrimitive.Root = SelectPrimitive.Root;

export const selectTriggerVariants = cva(
    "relative inline-flex h-8 w-full min-w-36 select-none items-center justify-between gap-2 rounded-lg border border-transparent bg-legacy-muted px-3 text-left text-foreground text-sm outline-none ring-ring/24 transition-[background-color,box-shadow] pointer-coarse:after:absolute pointer-coarse:after:size-full pointer-coarse:after:min-h-11 hover:bg-legacy-accent focus-visible:ring-[3px] aria-invalid:ring-[3px] aria-invalid:ring-destructive/16 data-disabled:pointer-events-none data-disabled:opacity-64 dark:bg-input/32 dark:aria-invalid:ring-destructive/24 dark:hover:bg-input/48 [&_[data-slot=select-trigger-icon]]:transition-[color,transform] [&_[data-slot=select-trigger-icon]]:duration-150 [&_[data-slot=select-trigger-icon]]:ease-[cubic-bezier(0.23,1,0.32,1)] hover:[&_[data-slot=select-trigger-icon]]:scale-105 hover:[&_[data-slot=select-trigger-icon]]:text-foreground/88 [&_svg:not([class*='opacity-'])]:opacity-80 [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
    {
        defaultVariants: {
            size: 'default',
        },
        variants: {
            size: {
                default: '',
                lg: 'h-9',
                sm: 'h-7 gap-1.5 px-[calc(--spacing(2.5)-1px)]',
            },
        },
    }
);

export const selectTriggerIconClassName = '-me-1 block rotate-90 size-4.5 opacity-80';

export function SelectTriggerIcon({ className }: { className?: string }): React.ReactElement {
    return (
        <span
            className={cn(
                'grid h-full shrink-0 translate-x-0.5 place-items-center self-center text-muted-foreground leading-none',
                className
            )}
            data-slot="select-trigger-icon"
        >
            <Icon className={selectTriggerIconClassName} icon={ChevronDoubleCloseIcon} />
        </span>
    );
}

export interface SelectButtonProps extends useRender.ComponentProps<'button'> {
    size?: VariantProps<typeof selectTriggerVariants>['size'];
}

export function SelectButton({
    className,
    size,
    render,
    children,
    ...props
}: SelectButtonProps): React.ReactElement {
    const typeValue: React.ButtonHTMLAttributes<HTMLButtonElement>['type'] = render
        ? undefined
        : 'button';

    const defaultProps = {
        children: (
            <>
                <span className="flex-1 truncate in-data-placeholder:text-muted-foreground/72">
                    {children}
                </span>
                <SelectTriggerIcon />
            </>
        ),
        className: cn(selectTriggerVariants({ size }), 'min-w-0', className),
        'data-slot': 'select-button',
        type: typeValue,
    };

    return useRender({
        defaultTagName: 'button',
        props: mergeProps<'button'>(defaultProps, props),
        render,
    });
}

export function SelectTrigger({
    className,
    size = 'default',
    children,
    ...props
}: SelectPrimitive.Trigger.Props & VariantProps<typeof selectTriggerVariants>): React.ReactElement {
    return (
        <SelectPrimitive.Trigger
            className={cn(selectTriggerVariants({ size }), className)}
            data-slot="select-trigger"
            {...props}
        >
            {children}
            <SelectPrimitive.Icon
                className="flex h-full shrink-0 items-center self-center leading-none"
                data-slot="select-icon"
            >
                <SelectTriggerIcon />
            </SelectPrimitive.Icon>
        </SelectPrimitive.Trigger>
    );
}

export function SelectValue({
    className,
    ...props
}: SelectPrimitive.Value.Props): React.ReactElement {
    return (
        <SelectPrimitive.Value
            className={cn(
                'flex min-w-0 flex-1 items-center truncate data-placeholder:text-muted-foreground',
                className
            )}
            data-slot="select-value"
            {...props}
        />
    );
}

export function SelectContent({
    className,
    children,
    side = 'bottom',
    sideOffset = 4,
    align = 'start',
    alignOffset = 0,
    alignItemWithTrigger = true,
    anchor,
    ...props
}: SelectPrimitive.Popup.Props & {
    side?: SelectPrimitive.Positioner.Props['side'];
    sideOffset?: SelectPrimitive.Positioner.Props['sideOffset'];
    align?: SelectPrimitive.Positioner.Props['align'];
    alignOffset?: SelectPrimitive.Positioner.Props['alignOffset'];
    alignItemWithTrigger?: SelectPrimitive.Positioner.Props['alignItemWithTrigger'];
    anchor?: SelectPrimitive.Positioner.Props['anchor'];
}): React.ReactElement {
    const listRef = React.useRef<HTMLDivElement | null>(null);
    const [listElement, setListElement] = React.useState<HTMLDivElement | null>(null);
    const edges = useScrollEdges(listRef, { enabled: Boolean(listElement), axis: 'vertical' });
    const {
        activeIndex,
        handlers,
        itemRects,
        measureItems,
        registerItem,
        sessionRef,
        setActiveIndex,
    } = useProximityHover(listRef);
    const previousItemCountRef = React.useRef(0);
    const [selectedIndex, setSelectedIndex] = React.useState<number | null>(null);
    const activeRect = activeIndex === null ? null : (itemRects[activeIndex] ?? null);
    const selectedRect = selectedIndex === null ? null : (itemRects[selectedIndex] ?? null);
    const isHoveringOther = activeIndex !== null && activeIndex !== selectedIndex;
    const handleListRef = React.useCallback((element: HTMLDivElement | null) => {
        listRef.current = element;
        setListElement(element);
    }, []);

    const syncSelectItems = React.useCallback(() => {
        const list = listElement;

        if (!list) {
            return;
        }

        const items = Array.from(list.querySelectorAll<HTMLElement>('[data-slot="select-item"]'));

        for (let index = 0; index < items.length; index += 1) {
            registerItem(index, items[index] ?? null);
        }

        for (let index = items.length; index < previousItemCountRef.current; index += 1) {
            registerItem(index, null);
        }

        previousItemCountRef.current = items.length;
        const nextSelectedIndex = items.findIndex(
            (item) =>
                item.hasAttribute('data-selected') || item.getAttribute('aria-selected') === 'true'
        );
        setSelectedIndex(nextSelectedIndex === -1 ? null : nextSelectedIndex);
        measureItems();
    }, [listElement, measureItems, registerItem]);

    React.useLayoutEffect(() => {
        syncSelectItems();

        const list = listElement;

        if (!list) {
            return;
        }

        const observer = new MutationObserver(() => {
            syncSelectItems();

            const highlightedIndex = Array.from(
                list.querySelectorAll<HTMLElement>('[data-slot="select-item"]')
            ).findIndex((item) => item.hasAttribute('data-highlighted'));

            setActiveIndex(highlightedIndex === -1 ? null : highlightedIndex);
        });

        observer.observe(list, {
            attributeFilter: ['aria-selected', 'data-highlighted', 'data-selected'],
            attributes: true,
            childList: true,
            subtree: true,
        });

        return () => observer.disconnect();
    }, [listElement, setActiveIndex, syncSelectItems]);

    return (
        <SelectPrimitive.Portal>
            <SelectPrimitive.Positioner
                align={align}
                alignItemWithTrigger={alignItemWithTrigger}
                alignOffset={alignOffset}
                anchor={anchor}
                className="z-50 select-none"
                data-slot="select-positioner"
                side={side}
                sideOffset={sideOffset}
            >
                <SelectPrimitive.Popup
                    data-slot="select-popup"
                    render={(popupProps, state) => {
                        const restProps = stripSelectMotionEventProps(popupProps);

                        return (
                            <motion.div
                                {...restProps}
                                animate={{
                                    opacity: state.transitionStatus === 'ending' ? 0 : 1,
                                    scaleY: state.transitionStatus === 'ending' ? 0.96 : 1,
                                    y: state.transitionStatus === 'ending' ? -4 : 0,
                                }}
                                className="origin-(--transform-origin) text-foreground outline-none"
                                initial={{ opacity: 0, scaleY: 0.96, y: -4 }}
                                transition={
                                    state.transitionStatus === 'ending'
                                        ? selectExitTransition
                                        : springs.fast
                                }
                            />
                        );
                    }}
                    {...props}
                >
                    <Elevated
                        className="relative h-full min-w-(--anchor-width) overflow-hidden rounded-xl"
                        offset={2}
                        shadowLevel={3}
                    >
                        <SelectPrimitive.List
                            className={cn(
                                'relative max-h-[min(var(--available-height),18.75rem)] min-w-(--anchor-width) overflow-y-auto p-1 outline-none',
                                className
                            )}
                            data-slot="select-list"
                            onMouseEnter={() => {
                                handlers.onMouseEnter();
                                syncSelectItems();
                            }}
                            onMouseLeave={handlers.onMouseLeave}
                            onMouseMove={handlers.onMouseMove}
                            ref={handleListRef}
                        >
                            <AnimatePresence>
                                {selectedRect ? (
                                    <motion.div
                                        animate={{
                                            opacity: isHoveringOther ? 0.72 : 1,
                                            top: selectedRect.top,
                                            left: selectedRect.left,
                                            width: selectedRect.width,
                                            height: selectedRect.height,
                                        }}
                                        className="pointer-events-none absolute rounded-[10px] bg-active"
                                        data-slot="select-selected-background"
                                        exit={{
                                            opacity: 0,
                                            transition: springs.moderate,
                                        }}
                                        initial={false}
                                        transition={{
                                            ...springs.moderate,
                                            opacity: { duration: 0.08 },
                                        }}
                                    />
                                ) : null}
                            </AnimatePresence>
                            <AnimatePresence>
                                {activeRect ? (
                                    <motion.div
                                        animate={{
                                            opacity: 1,
                                            top: activeRect.top,
                                            left: activeRect.left,
                                            width: activeRect.width,
                                            height: activeRect.height,
                                        }}
                                        className="pointer-events-none absolute rounded-[10px] bg-hover"
                                        data-slot="select-hover-background"
                                        exit={{ opacity: 0, transition: springs.fast }}
                                        initial={{
                                            opacity: 0,
                                            top: selectedRect?.top ?? activeRect.top,
                                            left: selectedRect?.left ?? activeRect.left,
                                            width: selectedRect?.width ?? activeRect.width,
                                            height: selectedRect?.height ?? activeRect.height,
                                        }}
                                        key={sessionRef.current}
                                        transition={{
                                            ...springs.fast,
                                            opacity: { duration: 0.08 },
                                        }}
                                    />
                                ) : null}
                            </AnimatePresence>
                            <ScrollEdgeCue edge="top" size="tight" visible={edges.top} />
                            {children}
                            <ScrollEdgeCue edge="bottom" size="tight" visible={edges.bottom} />
                        </SelectPrimitive.List>
                    </Elevated>
                </SelectPrimitive.Popup>
            </SelectPrimitive.Positioner>
        </SelectPrimitive.Portal>
    );
}

export function SelectItem({
    className,
    children,
    ...props
}: SelectPrimitive.Item.Props): React.ReactElement {
    return (
        <SelectPrimitive.Item
            className={cn(
                "relative z-10 grid min-h-8 in-data-[side=none]:min-w-[calc(var(--anchor-width)+1.25rem)] cursor-default grid-cols-[1rem_1fr] items-center gap-2 rounded-[10px] py-2 ps-2 pe-4 text-[13px] outline-none transition-colors duration-80 data-disabled:pointer-events-none data-highlighted:text-foreground data-selected:text-foreground data-disabled:opacity-50 [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
                className
            )}
            data-slot="select-item"
            {...props}
        >
            <SelectPrimitive.ItemIndicator className="col-start-1 text-foreground">
                <AnimatePresence initial={false}>
                    <motion.span
                        animate={{ opacity: 1, scale: 1 }}
                        className="flex size-4 items-center justify-center"
                        exit={{ opacity: 0, scale: 0.8 }}
                        initial={{ opacity: 0, scale: 0.8 }}
                        transition={{ duration: 0.08, ease: 'easeOut' }}
                    >
                        <Icon className="size-4" icon={Tick02Icon} />
                    </motion.span>
                </AnimatePresence>
            </SelectPrimitive.ItemIndicator>
            <SelectPrimitive.ItemText className="col-start-2 min-w-0 truncate">
                {children}
            </SelectPrimitive.ItemText>
        </SelectPrimitive.Item>
    );
}

export function SelectSeparator({
    className,
    ...props
}: SelectPrimitive.Separator.Props): React.ReactElement {
    return (
        <SelectPrimitive.Separator
            className={cn('mx-2 my-1 h-px bg-border', className)}
            data-slot="select-separator"
            {...props}
        />
    );
}

export function SelectGroup(props: SelectPrimitive.Group.Props): React.ReactElement {
    return <SelectPrimitive.Group data-slot="select-group" {...props} />;
}

export function SelectLabel({
    className,
    ...props
}: SelectPrimitive.Label.Props): React.ReactElement {
    return (
        <SelectPrimitive.Label
            className={cn(
                'not-in-data-[slot=field]:mb-2 inline-flex cursor-default items-center gap-2 font-medium text-foreground text-sm/4',
                className
            )}
            data-slot="select-label"
            {...props}
        />
    );
}

export function SelectGroupLabel(props: SelectPrimitive.GroupLabel.Props): React.ReactElement {
    return (
        <SelectPrimitive.GroupLabel
            className="px-2 py-1.5 font-medium text-muted-foreground text-xs"
            data-slot="select-group-label"
            {...props}
        />
    );
}

// Legacy compatibility: simple <select>-like wrapper using <option> children
interface SelectOption {
    disabled?: boolean;
    label: ReactNode;
    value: string;
}

type LegacySelectProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, 'multiple' | 'onChange'> & {
    onChange?: (event: ChangeEvent<HTMLSelectElement>) => void;
    placeholder?: string;
};

function collectOptions(children: ReactNode): SelectOption[] {
    return Children.toArray(children).flatMap((child) => {
        if (!isValidElement<React.ComponentProps<'option'>>(child) || child.type !== 'option') {
            return [];
        }
        return [
            {
                disabled: child.props.disabled,
                label: child.props.children,
                value: String(child.props.value ?? ''),
            },
        ];
    });
}

function normalizeValue(value: SelectHTMLAttributes<HTMLSelectElement>['value']) {
    if (typeof value === 'string') {
        return value;
    }
    if (typeof value === 'number') {
        return String(value);
    }
    return undefined;
}

export function LegacySelect({
    children,
    className,
    onChange,
    value,
    ...props
}: LegacySelectProps) {
    const options = collectOptions(children);
    const currentValue = normalizeValue(value ?? props.defaultValue);
    const currentOption = options.find((option) => option.value === currentValue);

    const handleValueChange = (nextValue: string | null) => {
        if (nextValue === null) {
            return;
        }
        onChange?.({
            target: { value: nextValue },
        } as ChangeEvent<HTMLSelectElement>);
    };

    return (
        <SelectPrimitive.Root
            defaultValue={normalizeValue(props.defaultValue)}
            disabled={props.disabled}
            name={props.name}
            onValueChange={handleValueChange}
            required={props.required}
            value={normalizeValue(value)}
        >
            <SelectTrigger className={className} data-slot="select" id={props.id}>
                <SelectValue placeholder={props.placeholder}>
                    {currentOption?.label ?? props.placeholder}
                </SelectValue>
            </SelectTrigger>

            <SelectContent>
                {options.map((option) => (
                    <SelectItem disabled={option.disabled} key={option.value} value={option.value}>
                        {option.label}
                    </SelectItem>
                ))}
            </SelectContent>
        </SelectPrimitive.Root>
    );
}

const selectExitTransition = {
    ...springs.fast,
    duration: 0.12,
};

function stripSelectMotionEventProps(props: React.HTMLAttributes<HTMLDivElement>) {
    const {
        onAnimationEnd,
        onAnimationIteration,
        onAnimationStart,
        onDrag,
        onDragEnd,
        onDragStart,
        ...restProps
    } = props;

    void onAnimationEnd;
    void onAnimationIteration;
    void onAnimationStart;
    void onDrag;
    void onDragEnd;
    void onDragStart;

    return restProps;
}

export { SelectPrimitive };
