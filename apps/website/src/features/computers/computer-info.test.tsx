import { CpuIcon, SoftwareIcon } from '@hugeicons-pro/core-stroke-rounded';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';
import { ComputerInfo } from './computer-info.tsx';

test('renders computer facts in an outlined HeroUI Pro item card group', () => {
    const markup = renderToStaticMarkup(
        <ComputerInfo
            facts={[
                { icon: CpuIcon, label: 'System', value: 'Mac · Apple Silicon' },
                { icon: SoftwareIcon, label: 'Computer version', value: 'v1.4.4' },
            ]}
        />
    );

    expect(markup).toContain('item-card-group--transparent');
    expect(markup).toContain('item-card-group--outline');
    expect(markup.match(/data-slot="item-card"/g)).toHaveLength(2);
    expect(markup.match(/data-slot="item-card-icon"/g)).toHaveLength(2);
    expect(markup.match(/data-slot="separator"/g)).toHaveLength(1);
    expect(markup).toContain('Mac · Apple Silicon');
});
