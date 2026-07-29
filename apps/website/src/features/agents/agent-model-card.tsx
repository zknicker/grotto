import type React from 'react';
import { Badge } from '../../components/ui/badge.tsx';
import { Card, CardContent } from '../../components/ui/card.tsx';
import type { ModelOptionItem } from '../../components/ui/model-route-shared.ts';
import { cn } from '../../lib/utils.ts';

function splitModelLabel(model: ModelOptionItem | null) {
    if (!model) {
        return {
            title: 'No model selected',
            value: 'Choose a configured model',
        };
    }

    const [title, value = model.value] = model.label.split(' · ');
    return { title, value };
}

export function AgentModelCard({
    action,
    className,
    label,
    model,
}: {
    action?: React.ReactNode;
    className?: string;
    label: string;
    model: ModelOptionItem | null;
}) {
    const copy = splitModelLabel(model);

    return (
        <Card className={cn('transition-colors hover:bg-hover', className)}>
            <CardContent className="flex items-start gap-3 p-4">
                <div className="min-w-0 flex-1">
                    <div className="text-muted-foreground text-xs uppercase tracking-[0.12em]">
                        {label}
                    </div>
                    <div className="mt-2 truncate font-medium text-sm">{copy.title}</div>
                    <div className="mt-1 truncate text-muted-foreground text-xs">{copy.value}</div>
                    {model ? (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                            <Badge variant="secondary">{model.provider}</Badge>
                        </div>
                    ) : null}
                </div>
                {action ? <div className="shrink-0">{action}</div> : null}
            </CardContent>
        </Card>
    );
}
