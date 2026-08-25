import { readFileSync } from 'node:fs';

/**
 * Minimal `.env.schema` reader shared by the contract check, the production
 * environment renderer, and the delivered-secret guard. It parses names and
 * decorators only — it never resolves a value and never contacts 1Password.
 */
export interface SchemaItem {
    hasExplicitSensitivity: boolean;
    isInternal: boolean;
    isRequiredInProduction: boolean;
    isSensitive: boolean;
    name: string;
}

/** Injected by varlock itself rather than delivered to any consumer. */
export const varlockBuiltins = new Set(['VARLOCK_ENV']);

const schemaItemPattern = /^([A-Z][A-Z0-9_]*)=/u;
const bareRequiredPattern = /@required(\s|$)/u;

export function readSchemaItems(schemaPath: string): SchemaItem[] {
    const contents = readFileSync(schemaPath, 'utf8');
    const dividerIndex = contents.indexOf('\n# ---');
    const body = dividerIndex === -1 ? contents : contents.slice(dividerIndex + 6);

    const items: SchemaItem[] = [];
    let decorators: string[] = [];

    for (const line of body.split('\n')) {
        if (line.startsWith('#')) {
            decorators.push(line);
            continue;
        }

        const match = schemaItemPattern.exec(line);
        if (match) {
            const attached = decorators.join(' ');
            items.push({
                hasExplicitSensitivity:
                    attached.includes('@sensitive') || attached.includes('@public'),
                isInternal: attached.includes('@internal'),
                isRequiredInProduction:
                    bareRequiredPattern.test(attached) ||
                    attached.includes('@required=forEnv(production'),
                isSensitive: attached.includes('@sensitive'),
                name: match[1],
            });
        }

        // A blank line (or the item itself) breaks decorator association.
        decorators = [];
    }

    return items;
}

/**
 * Items the platform is expected to deliver to a running consumer: everything
 * that is neither varlock machinery nor a varlock builtin.
 */
export function deliverableNames(items: SchemaItem[]): Set<string> {
    return new Set(
        items
            .filter((item) => !(item.isInternal || varlockBuiltins.has(item.name)))
            .map((item) => item.name)
    );
}

/**
 * Names in a rendered `KEY=value` environment file, read without ever touching
 * a value. Used by the delivered-secret guard against the production copy the
 * deploy job writes.
 */
export function readRenderedEnvironmentNames(path: string): string[] {
    const names: string[] = [];

    for (const line of readFileSync(path, 'utf8').split('\n')) {
        const match = /^([A-Z][A-Z0-9_]*)=/u.exec(line);
        if (match) {
            names.push(match[1]);
        }
    }

    return names;
}
