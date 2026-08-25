import type { Modifier } from '@dnd-kit/core';

const verticalOnly: Modifier = ({ transform }) => ({
    ...transform,
    x: 0,
});

const restrictToChannelList: Modifier = ({ containerNodeRect, draggingNodeRect, transform }) => {
    if (!(containerNodeRect && draggingNodeRect)) {
        return transform;
    }

    const minY = containerNodeRect.top - draggingNodeRect.top;
    const maxY = containerNodeRect.bottom - draggingNodeRect.bottom;

    return {
        ...transform,
        y: Math.min(Math.max(transform.y, minY), maxY),
    };
};

export const channelListModifiers: Modifier[] = [verticalOnly, restrictToChannelList];
