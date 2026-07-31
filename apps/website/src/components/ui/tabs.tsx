'use client';

import { Tabs as TabsPrimitive } from '@base-ui/react/tabs';
import type { IconSvgElement } from '@hugeicons/react';
import { AnimatePresence, motion } from 'framer-motion';
import * as React from 'react';
import { useProximityHover } from '../../hooks/use-proximity-hover.ts';
import { fontWeights } from '../../lib/font-weight.ts';
import { springs } from '../../lib/springs.ts';
import { cn } from '../../lib/utils.ts';
import { Icon } from './icon.tsx';
import { surfaceClasses, useSurface } from './surface.tsx';

interface TabsValueOrderContextValue {
    selectedValue: string | undefined;
    setValueOrder: (order: string[]) => void;
    valueOrder: string[];
}

const TabsValueOrderContext = React.createContext<TabsValueOrderContextValue | null>(null);

interface TabsListContextValue {
    hoveredIndex: number | null;
    registerTab: (index: number, value: string, element: HTMLElement | null) => void;
    selectedValue: string | undefined;
    setOptimisticIndex: (index: number) => void;
}

const TabsListContext = React.createContext<TabsListContextValue | null>(null);

function useTabsList() {
    const context = React.useContext(TabsListContext);

    if (!context) {
        throw new Error('TabItem must be used within a TabsList');
    }

    return context;
}

export interface TabsProps
    extends Omit<
        React.ComponentPropsWithoutRef<typeof TabsPrimitive.Root>,
        'defaultValue' | 'onSelect' | 'onValueChange' | 'value'
    > {
    defaultValue?: string;
    onSelect?: (index: number) => void;
    onValueChange?: (value: string) => void;
    selectedIndex?: number;
    value?: string;
}

export const Tabs = React.forwardRef<HTMLDivElement, TabsProps>(
    ({ children, defaultValue, onSelect, onValueChange, selectedIndex, value, ...props }, ref) => {
        const [valueOrder, setValueOrder] = React.useState<string[]>([]);
        const [uncontrolledValue, setUncontrolledValue] = React.useState<string | undefined>(
            defaultValue
        );
        const updateValueOrder = React.useCallback((order: string[]) => {
            setValueOrder((current) => {
                if (
                    current.length === order.length &&
                    current.every((currentValue, index) => currentValue === order[index])
                ) {
                    return current;
                }

                return order;
            });
        }, []);

        const resolvedValue =
            value ?? (selectedIndex !== undefined ? valueOrder[selectedIndex] : uncontrolledValue);

        const handleValueChange = React.useCallback(
            (newValue: unknown) => {
                const nextValue = String(newValue);

                if (value === undefined && selectedIndex === undefined) {
                    setUncontrolledValue(nextValue);
                }

                onValueChange?.(nextValue);

                if (onSelect) {
                    const nextIndex = valueOrder.indexOf(nextValue);

                    if (nextIndex !== -1) {
                        onSelect(nextIndex);
                    }
                }
            },
            [onSelect, onValueChange, selectedIndex, value, valueOrder]
        );

        return (
            <TabsValueOrderContext.Provider
                value={{
                    selectedValue: resolvedValue,
                    setValueOrder: updateValueOrder,
                    valueOrder,
                }}
            >
                <TabsPrimitive.Root
                    defaultValue={resolvedValue === undefined ? defaultValue : undefined}
                    onValueChange={handleValueChange}
                    ref={ref}
                    value={resolvedValue}
                    {...props}
                >
                    {children}
                </TabsPrimitive.Root>
            </TabsValueOrderContext.Provider>
        );
    }
);

Tabs.displayName = 'Tabs';

export type TabsListProps = React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>;

export const TabsList = React.forwardRef<HTMLDivElement, TabsListProps>(
    ({ children, className, ...props }, ref) => {
        const containerRef = React.useRef<HTMLDivElement | null>(null);
        const isMouseInside = React.useRef(false);
        const substrate = useSurface();
        const indicatorLevel = Math.min(substrate + 3, 8);
        const valueOrderContext = React.useContext(TabsValueOrderContext);
        const [optimisticIndex, setOptimisticIndex] = React.useState<number | null>(null);
        const values = React.useMemo(
            () =>
                React.Children.toArray(children)
                    .filter(React.isValidElement)
                    .map((child) => (child.props as { value?: string }).value)
                    .filter((childValue): childValue is string => typeof childValue === 'string'),
            [children]
        );
        const setValueOrder = valueOrderContext?.setValueOrder;

        React.useLayoutEffect(() => {
            setValueOrder?.(values);
        }, [setValueOrder, values]);

        const {
            activeIndex: hoveredIndex,
            handlers,
            itemRects,
            measureItems,
            registerItem,
            setActiveIndex: setHoveredIndex,
        } = useProximityHover(containerRef, { axis: 'x' });

        const registerTab = React.useCallback(
            (index: number, _value: string, element: HTMLElement | null) => {
                registerItem(index, element);
            },
            [registerItem]
        );

        React.useEffect(() => {
            measureItems();
        }, [measureItems]);

        React.useEffect(() => {
            const element = containerRef.current;

            if (!element) {
                return;
            }

            const observer = new ResizeObserver(() => measureItems());
            observer.observe(element);

            return () => observer.disconnect();
        }, [measureItems]);

        const handleMouseMove = React.useCallback(
            (event: React.MouseEvent) => {
                isMouseInside.current = true;
                handlers.onMouseMove(event);
            },
            [handlers]
        );

        const handleMouseLeave = React.useCallback(() => {
            isMouseInside.current = false;
            handlers.onMouseLeave();
        }, [handlers]);

        const [focusedIndex, setFocusedIndex] = React.useState<number | null>(null);
        const selectedValue = valueOrderContext?.selectedValue;
        const selectedIndex = selectedValue === undefined ? -1 : values.indexOf(selectedValue);

        React.useEffect(() => {
            setOptimisticIndex(selectedIndex >= 0 ? selectedIndex : null);
        }, [selectedIndex]);

        const activeSelectedIndex = optimisticIndex;
        const selectedRect = activeSelectedIndex === null ? null : itemRects[activeSelectedIndex];
        const hoverRect = hoveredIndex === null ? null : itemRects[hoveredIndex];
        const focusRect = focusedIndex === null ? null : itemRects[focusedIndex];
        const isHoveringSelected = hoveredIndex === activeSelectedIndex;
        const isHovering = hoveredIndex !== null && !isHoveringSelected;
        const indexedChildren = React.Children.map(children, (child, index) => {
            if (React.isValidElement(child)) {
                return React.cloneElement(child, { _index: index } as Record<string, unknown>);
            }

            return child;
        });

        return (
            <TabsListContext.Provider
                value={{
                    hoveredIndex,
                    registerTab,
                    selectedValue,
                    setOptimisticIndex,
                }}
            >
                <TabsPrimitive.List
                    activateOnFocus
                    className={cn(
                        'relative inline-flex select-none items-center gap-0.5 rounded-lg bg-legacy-muted/50 p-1',
                        className
                    )}
                    onBlur={(event) => {
                        if (containerRef.current?.contains(event.relatedTarget as Node)) {
                            return;
                        }

                        setFocusedIndex(null);

                        if (!isMouseInside.current) {
                            setHoveredIndex(null);
                        }
                    }}
                    onFocus={(event) => {
                        const trigger = (event.target as HTMLElement).closest('[role="tab"]');

                        if (!trigger) {
                            return;
                        }

                        const indexAttribute = trigger.getAttribute('data-proximity-index');

                        if (indexAttribute !== null) {
                            const index = Number(indexAttribute);

                            setHoveredIndex(index);
                            setFocusedIndex(
                                (event.target as HTMLElement).matches(':focus-visible')
                                    ? index
                                    : null
                            );
                        }
                    }}
                    onMouseLeave={handleMouseLeave}
                    onMouseMove={handleMouseMove}
                    ref={(node) => {
                        containerRef.current = node;

                        if (typeof ref === 'function') {
                            ref(node);
                        } else if (ref) {
                            ref.current = node;
                        }
                    }}
                    {...props}
                >
                    {selectedRect ? (
                        <motion.div
                            animate={{
                                height: selectedRect.height,
                                left: selectedRect.left,
                                opacity: isHovering ? 0.85 : 1,
                                top: selectedRect.top,
                                width: selectedRect.width,
                            }}
                            className={cn(
                                'pointer-events-none absolute rounded-md',
                                surfaceClasses(indicatorLevel)
                            )}
                            initial={false}
                            transition={{ ...springs.moderate, opacity: { duration: 0.08 } }}
                        />
                    ) : null}

                    <AnimatePresence>
                        {hoverRect && !isHoveringSelected && selectedRect ? (
                            <motion.div
                                animate={{
                                    height: hoverRect.height,
                                    left: hoverRect.left,
                                    opacity: 1,
                                    top: hoverRect.top,
                                    width: hoverRect.width,
                                }}
                                className="pointer-events-none absolute rounded-md bg-active"
                                exit={
                                    isMouseInside.current
                                        ? { opacity: 0, transition: springs.fast }
                                        : {
                                              height: selectedRect.height,
                                              left: selectedRect.left,
                                              opacity: 0,
                                              top: selectedRect.top,
                                              transition: {
                                                  ...springs.moderate,
                                                  opacity: { duration: 0.06 },
                                              },
                                              width: selectedRect.width,
                                          }
                                }
                                initial={{
                                    height: selectedRect.height,
                                    left: selectedRect.left,
                                    opacity: 0,
                                    top: selectedRect.top,
                                    width: selectedRect.width,
                                }}
                                transition={{ ...springs.fast, opacity: { duration: 0.08 } }}
                            />
                        ) : null}
                    </AnimatePresence>

                    <AnimatePresence>
                        {focusRect ? (
                            <motion.div
                                animate={{
                                    height: focusRect.height + 4,
                                    left: focusRect.left - 2,
                                    top: focusRect.top - 2,
                                    width: focusRect.width + 4,
                                }}
                                className="pointer-events-none absolute z-20 rounded-lg border border-ring"
                                exit={{ opacity: 0, transition: springs.fast }}
                                initial={false}
                                transition={{ ...springs.fast, opacity: { duration: 0.08 } }}
                            />
                        ) : null}
                    </AnimatePresence>

                    {indexedChildren}
                </TabsPrimitive.List>
            </TabsListContext.Provider>
        );
    }
);

TabsList.displayName = 'TabsList';

export interface TabItemProps extends React.ComponentPropsWithoutRef<typeof TabsPrimitive.Tab> {
    _index?: number;
    icon?: IconSvgElement;
    iconOnly?: boolean;
    label: string;
    value: string;
}

export const TabItem = React.forwardRef<HTMLButtonElement, TabItemProps>(
    (
        {
            _index = 0,
            'aria-label': ariaLabel,
            className,
            icon,
            iconOnly = false,
            label,
            title,
            value,
            ...props
        },
        ref
    ) => {
        const internalRef = React.useRef<HTMLButtonElement | null>(null);
        const { hoveredIndex, registerTab, selectedValue, setOptimisticIndex } = useTabsList();

        React.useEffect(() => {
            registerTab(_index, value, internalRef.current);

            return () => registerTab(_index, value, null);
        }, [_index, registerTab, value]);

        const isSelected = selectedValue === value;
        const isActive = hoveredIndex === _index || isSelected;

        return (
            <TabsPrimitive.Tab
                aria-label={iconOnly ? (ariaLabel ?? label) : ariaLabel}
                className={cn(
                    'relative z-10 flex cursor-pointer items-center gap-2 border-none bg-transparent px-3 py-1.5 outline-none',
                    iconOnly && 'size-7 justify-center p-0',
                    className
                )}
                data-proximity-index={_index}
                onClick={() => setOptimisticIndex(_index)}
                ref={(node) => {
                    internalRef.current = node as HTMLButtonElement | null;

                    if (typeof ref === 'function') {
                        ref(node as HTMLButtonElement | null);
                    } else if (ref) {
                        ref.current = node as HTMLButtonElement | null;
                    }
                }}
                title={iconOnly ? (title ?? label) : title}
                value={value}
                {...props}
            >
                {icon ? (
                    <Icon
                        className={cn(
                            'shrink-0 transition-[color,stroke-width] duration-80',
                            isActive ? 'text-foreground' : 'text-muted-foreground'
                        )}
                        icon={icon}
                        size={16}
                    />
                ) : null}
                {iconOnly ? null : (
                    <span className="inline-grid whitespace-nowrap text-[13px]">
                        <span
                            aria-hidden="true"
                            className="invisible col-start-1 row-start-1"
                            style={{ fontVariationSettings: fontWeights.semibold }}
                        >
                            {label}
                        </span>
                        <span
                            className={cn(
                                'col-start-1 row-start-1 transition-[color,font-variation-settings] duration-80',
                                isActive ? 'text-foreground' : 'text-muted-foreground'
                            )}
                            style={{
                                fontVariationSettings: isSelected
                                    ? fontWeights.semibold
                                    : fontWeights.normal,
                            }}
                        >
                            {label}
                        </span>
                    </span>
                )}
            </TabsPrimitive.Tab>
        );
    }
);

TabItem.displayName = 'TabItem';

export interface TabPanelProps extends React.ComponentPropsWithoutRef<typeof TabsPrimitive.Panel> {
    value: string;
}

export const TabPanel = React.forwardRef<HTMLDivElement, TabPanelProps>(
    ({ className, ...props }, ref) => (
        <TabsPrimitive.Panel className={cn('outline-none', className)} ref={ref} {...props} />
    )
);

TabPanel.displayName = 'TabPanel';
