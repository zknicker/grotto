/**
 * Compact human identity mark for sidebar rows. Stock HeroUI Avatar has no
 * size below 32px, and sidebar icon slots run 20–24px — so this is a
 * domain component (the human sibling of the agent face art), not a
 * restyled Avatar.
 */
export function MemberInitialsAvatar({
    imageUrl,
    label,
    size = 24,
}: {
    imageUrl?: string | null;
    label: string;
    size?: number;
}) {
    return (
        <span
            className="flex shrink-0 select-none items-center justify-center overflow-hidden rounded-full bg-surface-tertiary font-medium text-[10px] text-muted leading-none"
            style={{ height: size, width: size }}
        >
            {imageUrl ? (
                <img
                    alt=""
                    className="size-full object-cover"
                    height={size}
                    src={imageUrl}
                    width={size}
                />
            ) : (
                label
            )}
        </span>
    );
}
