import { structuredPatch } from 'diff';

// Shared diff model for every Grotto diff surface (changed-files drawer, Wiki
// page history). Renders through DiffView so all diffs read the same.

export interface DiffLine {
    kind: 'add' | 'context' | 'del';
    newLine: null | number;
    oldLine: null | number;
    text: string;
}

export interface DiffHunk {
    header: string;
    lines: DiffLine[];
}

export interface DiffStats {
    additions: number;
    deletions: number;
}

export function buildDiffHunks(
    beforeText: string,
    afterText: string,
    contextLines = 3
): DiffHunk[] {
    const patch = structuredPatch('before', 'after', beforeText, afterText, undefined, undefined, {
        context: contextLines,
    });

    return patch.hunks.map((hunk) => {
        let oldLine = hunk.oldStart;
        let newLine = hunk.newStart;
        const lines: DiffLine[] = [];

        for (const raw of hunk.lines) {
            const marker = raw[0];
            const text = raw.slice(1);
            if (marker === '\\') {
                continue;
            }
            if (marker === '+') {
                lines.push({ kind: 'add', newLine: newLine++, oldLine: null, text });
            } else if (marker === '-') {
                lines.push({ kind: 'del', newLine: null, oldLine: oldLine++, text });
            } else {
                lines.push({ kind: 'context', newLine: newLine++, oldLine: oldLine++, text });
            }
        }

        return {
            header: `@@ -${hunk.oldStart},${hunk.oldLines} +${hunk.newStart},${hunk.newLines} @@`,
            lines,
        };
    });
}

export function countDiffStats(hunks: DiffHunk[]): DiffStats {
    let additions = 0;
    let deletions = 0;
    for (const hunk of hunks) {
        for (const line of hunk.lines) {
            if (line.kind === 'add') {
                additions += 1;
            } else if (line.kind === 'del') {
                deletions += 1;
            }
        }
    }
    return { additions, deletions };
}
