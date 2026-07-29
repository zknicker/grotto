import {
    Popover,
    PopoverClose,
    PopoverPopup,
    PopoverTrigger,
} from '../../components/ui/popover.tsx';
import type { TaskLabelColor } from '../../lib/trpc.tsx';
import { cn } from '../../lib/utils.ts';
import { LabelDot } from './label-chip.tsx';
import { taskLabelColorNames, taskLabelColors, taskLabelDotClass } from './label-colors.ts';

// A small popover of the nine palette swatches. The trigger shows the current
// color; picking one closes the popover.
export function LabelSwatchPicker({
    color,
    disabled = false,
    onChange,
}: {
    color: TaskLabelColor;
    disabled?: boolean;
    onChange: (color: TaskLabelColor) => void;
}) {
    return (
        <Popover>
            <PopoverTrigger
                aria-label={`Color: ${taskLabelColorNames[color]}`}
                className="flex size-6 shrink-0 items-center justify-center rounded-md outline-none hover:bg-hover focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40"
                disabled={disabled}
            >
                <LabelDot color={color} />
            </PopoverTrigger>
            <PopoverPopup align="start" className="w-auto p-2" sideOffset={6}>
                <div className="grid grid-cols-3 gap-1">
                    {taskLabelColors.map((option) => (
                        <PopoverClose
                            aria-label={taskLabelColorNames[option]}
                            className={cn(
                                'flex size-7 items-center justify-center rounded-md outline-none hover:bg-hover focus-visible:ring-2 focus-visible:ring-ring',
                                option === color && 'bg-active'
                            )}
                            key={option}
                            onClick={() => onChange(option)}
                        >
                            <span
                                className={cn('size-3.5 rounded-full', taskLabelDotClass[option])}
                            />
                        </PopoverClose>
                    ))}
                </div>
            </PopoverPopup>
        </Popover>
    );
}
