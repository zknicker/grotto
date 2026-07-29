import { type ClassValue, clsx } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

/*
 * tailwind-merge only knows the stock t-shirt font sizes, so it classifies the
 * app's custom scale tokens (text-meta, text-caption, text-micro, text-chat,
 * text-code) as text *colors* — `cn('text-meta', 'text-muted-foreground')`
 * would silently drop the size. Registering them in the font-size group keeps
 * size and color merging independently.
 */
const twMerge = extendTailwindMerge({
    extend: {
        classGroups: {
            'font-size': [{ text: ['micro', 'caption', 'meta', 'chat', 'code'] }],
        },
    },
});

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}
