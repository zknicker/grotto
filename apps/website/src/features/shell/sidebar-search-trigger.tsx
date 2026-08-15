import { SearchField } from '@heroui/react';
import { sidebarHeaderBandClassName } from './section-header.tsx';

export function SidebarSearchTrigger({
    onPreload,
    onPress,
}: {
    onPreload: () => void;
    onPress: () => void;
}) {
    return (
        <div className={sidebarHeaderBandClassName} onPointerEnter={onPreload}>
            <SearchField aria-label="Search" fullWidth isReadOnly variant="secondary">
                <SearchField.Group>
                    <SearchField.SearchIcon />
                    <SearchField.Input onFocus={onPress} placeholder="Search" />
                </SearchField.Group>
            </SearchField>
        </div>
    );
}
