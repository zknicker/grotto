import os from 'node:os';
import { join } from 'node:path';
import { z } from 'zod';

// There is no env-file loading here on purpose. The committed root
// `.env.schema` is the environment contract and Varlock is the only loader:
// operator entry points run under `varlock run`, and the hosted Server reads
// the `config/server.env` the deploy job renders from that same schema. This
// module only validates and shapes what it is given.

function isTestEnvironment() {
    return process.env.NODE_ENV === 'test';
}

export function getDefaultGrottoServerPort() {
    const port = process.env.GROTTO_SERVER_PORT;

    return port && isValidPort(port) ? Number(port) : 8090;
}

export function getDefaultDatabaseUrl() {
    return `postgres://127.0.0.1:5432/grotto${isTestEnvironment() ? '_test' : ''}`;
}

export function getDefaultGrottoAttachmentRoot() {
    return join(os.homedir(), '.grotto', 'server', 'attachments');
}

export function getDefaultClerkIssuerUrl() {
    return 'https://clerk.grotto.sh';
}

function resolveHomePath(value: string) {
    if (value === '~') {
        return os.homedir();
    }

    if (value.startsWith('~/')) {
        return join(os.homedir(), value.slice(2));
    }

    return value;
}

export function getDefaultAppOrigin() {
    const websitePort = process.env.GROTTO_WEBSITE_PORT;

    return `http://localhost:${isValidPort(websitePort) ? websitePort : '3100'}`;
}

const envSchema = z
    .object({
        GROTTO_APP_ORIGIN: z.string().url().default(getDefaultAppOrigin()),
        GROTTO_CLERK_API_URL: z.string().url().optional(),
        GROTTO_CLERK_ISSUER_URL: z.string().url().default(getDefaultClerkIssuerUrl()),
        GROTTO_CLERK_SECRET_KEY: z.string().min(1).optional(),
        GROTTO_DEV_CLERK_SIGN_IN_USER_ID: z.string().min(1).optional(),
        GROTTO_ATTACHMENT_ROOT: z
            .string()
            .min(1)
            .default(getDefaultGrottoAttachmentRoot())
            .transform(resolveHomePath),
        GROTTO_COMPUTER_RELEASE_MANIFEST_URL: z.string().url().optional(),
        GROTTO_DATABASE_URL: z.string().min(1).default(getDefaultDatabaseUrl()),
        GROTTO_OPENAI_API_KEY: z.string().min(1).optional(),
        GROTTO_RELEASE_MANIFEST: z.string().min(1).transform(resolveHomePath).optional(),
        GROTTO_SERVER_PORT: z.coerce
            .number()
            .int()
            .positive()
            .default(getDefaultGrottoServerPort()),
        GROTTO_STATIC_APP_ROOT: z.string().min(1).transform(resolveHomePath).optional(),
    })
    .superRefine((value, context) => {
        if (
            value.GROTTO_RELEASE_MANIFEST &&
            (!value.GROTTO_CLERK_SECRET_KEY || value.GROTTO_CLERK_SECRET_KEY === 'INJECT_ON_HOST')
        ) {
            context.addIssue({
                code: 'custom',
                message: 'GROTTO_CLERK_SECRET_KEY is required for a production Grotto release.',
                path: ['GROTTO_CLERK_SECRET_KEY'],
            });
        }
    });

export function parseEnvironment(values: NodeJS.ProcessEnv) {
    return envSchema.parse(values);
}

export const env = parseEnvironment(process.env);

function isValidPort(value: string | undefined) {
    if (!(value && /^\d+$/u.test(value))) {
        return false;
    }

    const numericValue = Number(value);

    return Number.isInteger(numericValue) && numericValue > 0 && numericValue <= 65_535;
}
