export interface SourceSizePolicy {
    legacyCeilings: Record<string, number>;
    lineLimit: number;
    namedExceptions: Record<string, { maxLines: number; reason: string }>;
}

interface SourceFile {
    lines: number;
    path: string;
}

const sourceExtension = /\.(?:[cm]?[jt]sx?|py|rs|sh|swift)$/;

export function isSourcePath(path: string): boolean {
    return sourceExtension.test(path);
}

export function countSourceLines(source: string): number {
    if (source.length === 0) {
        return 0;
    }
    return source.split(/\r?\n/).length - (source.endsWith('\n') ? 1 : 0);
}

export function evaluateSourceSizes(files: SourceFile[], policy: SourceSizePolicy): string[] {
    const failures = validatePolicy(policy);
    const filesByPath = new Map(files.map((file) => [file.path, file]));

    for (const file of files) {
        failures.push(...inspectFile(file, policy));
    }

    for (const path of policyPaths(policy)) {
        if (!filesByPath.has(path)) {
            failures.push(`${path}: policy entry has no matching source file`);
        }
    }

    return failures.sort();
}

function validatePolicy(policy: SourceSizePolicy): string[] {
    const failures: string[] = [];
    for (const [path, ceiling] of Object.entries(policy.legacyCeilings)) {
        if (path in policy.namedExceptions) {
            failures.push(`${path}: listed as both a named exception and legacy debt`);
        }
        if (ceiling <= policy.lineLimit) {
            failures.push(`${path}: legacy ceiling ${ceiling} must exceed ${policy.lineLimit}`);
        }
    }

    for (const [path, exception] of Object.entries(policy.namedExceptions)) {
        if (!exception.reason.trim()) {
            failures.push(`${path}: named exception needs a reason`);
        }
        if (exception.maxLines <= policy.lineLimit) {
            failures.push(
                `${path}: named ceiling ${exception.maxLines} must exceed ${policy.lineLimit}`
            );
        }
    }
    return failures;
}

function inspectFile(file: SourceFile, policy: SourceSizePolicy): string[] {
    const namedException = policy.namedExceptions[file.path];
    if (namedException) {
        return file.lines > namedException.maxLines
            ? [`${file.path}: ${file.lines} lines exceeds named ceiling ${namedException.maxLines}`]
            : [];
    }

    const legacyCeiling = policy.legacyCeilings[file.path];
    if (legacyCeiling !== undefined) {
        if (file.lines > legacyCeiling) {
            return [`${file.path}: ${file.lines} lines exceeds legacy ceiling ${legacyCeiling}`];
        }
        return file.lines < legacyCeiling
            ? [`${file.path}: lower its legacy ceiling from ${legacyCeiling} to ${file.lines}`]
            : [];
    }

    return file.lines > policy.lineLimit
        ? [`${file.path}: ${file.lines} lines exceeds limit ${policy.lineLimit}`]
        : [];
}

function policyPaths(policy: SourceSizePolicy): string[] {
    return [...Object.keys(policy.namedExceptions), ...Object.keys(policy.legacyCeilings)];
}

async function readSourceFiles(): Promise<SourceFile[]> {
    const listed = Bun.spawnSync(['git', 'ls-files', '-co', '--exclude-standard', '-z']);
    if (listed.exitCode !== 0) {
        throw new Error(new TextDecoder().decode(listed.stderr).trim() || 'git ls-files failed');
    }

    const paths = new TextDecoder().decode(listed.stdout).split('\0').filter(isSourcePath);
    const files: SourceFile[] = [];
    for (const path of paths) {
        const file = Bun.file(path);
        if (await file.exists()) {
            files.push({ lines: countSourceLines(await file.text()), path });
        }
    }
    return files;
}

async function main() {
    const policy = (await Bun.file(
        new URL('./source-size-policy.json', import.meta.url)
    ).json()) as SourceSizePolicy;
    const files = await readSourceFiles();
    const failures = evaluateSourceSizes(files, policy);
    if (failures.length > 0) {
        console.error(`Source-size policy failed:\n\n${failures.join('\n')}`);
        process.exitCode = 1;
        return;
    }

    console.log(
        `Source-size policy passed for ${files.length} files (default ${policy.lineLimit} lines).`
    );
}

if (import.meta.main) {
    await main();
}
