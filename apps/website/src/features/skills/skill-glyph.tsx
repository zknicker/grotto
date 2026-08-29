import { getSenderCssVar } from '../rows/sender-color.ts';
import { formatSkillName } from './skill-name-format.ts';

/**
 * A skill's mark for an `ItemCard.Icon` slot. The skill contract carries no
 * icon (SKILL.md frontmatter is name and description), so every skill draws
 * the same way connections without a stored icon do: a monogram tinted from
 * the shared sender palette, keyed on the skill's stable name so the color
 * survives edits (the content hash does not).
 */
export function SkillGlyph({ name }: { name: string }) {
    return (
        <span className="font-medium text-sm" style={{ color: `var(${getSenderCssVar(name)})` }}>
            {monogramLetter(formatSkillName(name))}
        </span>
    );
}

function monogramLetter(name: string): string {
    return [...name.trim()][0]?.toUpperCase() ?? '?';
}
