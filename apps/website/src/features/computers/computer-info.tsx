import { Separator } from '@heroui/react';
import { ItemCard, ItemCardGroup } from '@heroui-pro/react';
import type { IconSvgElement } from '@hugeicons/react';
import { Fragment } from 'react';
import { Icon } from '../../components/ui/icon.tsx';

interface ComputerFact {
    icon: IconSvgElement;
    label: string;
    value: string;
}

export function ComputerInfo({ facts }: { facts: ComputerFact[] }) {
    return (
        <section className="py-5">
            <ItemCardGroup variant="transparent">
                <ItemCardGroup.Header>
                    <ItemCardGroup.Title>Info</ItemCardGroup.Title>
                </ItemCardGroup.Header>
                <ItemCardGroup variant="outline">
                    {facts.map((fact, index) => (
                        <Fragment key={fact.label}>
                            {index > 0 ? <Separator /> : null}
                            <ItemCard>
                                <ItemCard.Icon>
                                    <Icon icon={fact.icon} />
                                </ItemCard.Icon>
                                <ItemCard.Content>
                                    <ItemCard.Title>{fact.label}</ItemCard.Title>
                                    <ItemCard.Description>{fact.value}</ItemCard.Description>
                                </ItemCard.Content>
                            </ItemCard>
                        </Fragment>
                    ))}
                </ItemCardGroup>
            </ItemCardGroup>
        </section>
    );
}
