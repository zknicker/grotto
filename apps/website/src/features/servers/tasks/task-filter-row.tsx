import { Button, ButtonGroup, Dropdown, Label } from '@heroui/react';
import { Cancel01Icon, PlusSignIcon } from '@hugeicons-pro/core-stroke-rounded';
import { Icon } from '../../../components/ui/icon.tsx';
import { TaskFilterMenu } from './task-filter-menu.tsx';
import { hasAddableFilter, type TaskFilterField } from './task-filters.tsx';

/**
 * The applied filters, as one editable pill each. The row renders nothing
 * until something is applied, so a page with no query carries no chrome —
 * the filter and display controls live in the topbar instead.
 */
export function TaskFilterRow({ fields }: { fields: TaskFilterField[] }) {
    const applied = fields.filter((field) => field.applied !== null);
    if (applied.length === 0) {
        return null;
    }

    return (
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
            {applied.map((field) => (
                <TaskFilterPill field={field} key={field.id} />
            ))}
            {/* Contextual, unlike the topbar's funnel: with nothing left to
                add there is nothing for this button to mean. */}
            {hasAddableFilter(fields) ? (
                <TaskFilterMenu fields={fields} icon={PlusSignIcon} label="Add filter" />
            ) : null}
            {applied.length > 1 ? (
                <Button
                    className="ms-auto text-muted"
                    onPress={() => {
                        for (const field of applied) {
                            field.clear();
                        }
                    }}
                    size="sm"
                    variant="ghost"
                >
                    Clear
                </Button>
            ) : null}
        </div>
    );
}

/** `Field is Value ✕` as one joined control, the way Linear reads a filter. */
function TaskFilterPill({ field }: { field: TaskFilterField }) {
    const applied = field.applied;
    if (!applied) {
        return null;
    }

    return (
        <ButtonGroup size="sm" variant="outline">
            {/* The field and operator name the filter; only the value is a
                control, because changing the field is just a different filter. */}
            <Button className="pointer-events-none gap-1.5 text-muted" excludeFromTabOrder>
                <Icon aria-hidden="true" icon={field.icon} size={14} />
                {field.label}
            </Button>
            <Button className="pointer-events-none px-1 text-muted" excludeFromTabOrder>
                <ButtonGroup.Separator />
                is
            </Button>
            <Dropdown>
                <Button
                    aria-label={`${field.label} is ${applied.label}`}
                    className="gap-1.5"
                    size="sm"
                    variant="outline"
                >
                    <ButtonGroup.Separator />
                    {applied.leading}
                    {applied.label}
                </Button>
                <Dropdown.Popover placement="bottom start">
                    <Dropdown.Menu onAction={(key) => field.apply(String(key))}>
                        {field.options.map((option) => (
                            <Dropdown.Item id={option.id} key={option.id} textValue={option.label}>
                                {option.leading}
                                <Label>{option.label}</Label>
                            </Dropdown.Item>
                        ))}
                    </Dropdown.Menu>
                </Dropdown.Popover>
            </Dropdown>
            <Button
                aria-label={`Remove ${field.label} filter`}
                isIconOnly
                onPress={field.clear}
                size="sm"
                variant="outline"
            >
                <ButtonGroup.Separator />
                <Icon aria-hidden="true" icon={Cancel01Icon} size={13} />
            </Button>
        </ButtonGroup>
    );
}
