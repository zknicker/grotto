/**
 * The one place Grotto reads a human's email addresses. Clerk owns them, and
 * Grotto keeps no profile email for a User — the only address it stores is the
 * one an invitation is bound to, which is a target rather than an identity.
 *
 * The lookup is keyed by the subject of an already-verified session token, never
 * by anything the browser supplied, and an address counts only when Clerk
 * reports it verified. Clerk Organizations and Clerk role metadata are never
 * read — they carry no Grotto authority.
 */
export interface ClerkUsers {
    readVerifiedEmails(clerkUserId: string): Promise<string[]>;
}

export interface ClerkUsersOptions {
    /** Clerk Backend API origin; overridden for a non-production Clerk instance. */
    apiUrl?: string;
    fetch?: (url: string, init: RequestInit) => Promise<Response>;
    /** Absent in deployments that have not configured the invitation boundary. */
    secretKey: string | undefined;
}

const defaultClerkApiUrl = 'https://api.clerk.com';

export function createClerkUsers(options: ClerkUsersOptions): ClerkUsers {
    const call = options.fetch ?? globalThis.fetch;
    const clerkUsersUrl = `${(options.apiUrl ?? defaultClerkApiUrl).replace(/\/$/u, '')}/v1/users`;

    return {
        async readVerifiedEmails(clerkUserId) {
            if (!options.secretKey) {
                throw new Error(
                    'Server invitations need GROTTO_CLERK_SECRET_KEY so the Server can confirm a verified email address.'
                );
            }

            const response = await call(`${clerkUsersUrl}/${encodeURIComponent(clerkUserId)}`, {
                headers: {
                    Authorization: `Bearer ${options.secretKey}`,
                    'Content-Type': 'application/json',
                },
                method: 'GET',
            });

            if (!response.ok) {
                // Failing closed matters more than a friendly message: treating a
                // Clerk outage as "no verified addresses" would silently refuse
                // every legitimate acceptance and look like a mismatch.
                throw new Error(`Clerk user lookup failed with status ${response.status}.`);
            }

            return readVerifiedAddresses(await response.json());
        },
    };
}

interface ClerkEmailAddress {
    email_address?: unknown;
    verification?: { status?: unknown } | null;
}

function readVerifiedAddresses(payload: unknown): string[] {
    if (typeof payload !== 'object' || payload === null || !('email_addresses' in payload)) {
        return [];
    }

    const { email_addresses: addresses } = payload as { email_addresses: unknown };

    if (!Array.isArray(addresses)) {
        return [];
    }

    return addresses
        .filter((address): address is ClerkEmailAddress => isVerifiedAddress(address))
        .map((address) => String(address.email_address).trim().toLowerCase())
        .filter((address) => address.length > 0);
}

function isVerifiedAddress(value: unknown): boolean {
    if (typeof value !== 'object' || value === null) {
        return false;
    }

    const address = value as ClerkEmailAddress;

    return typeof address.email_address === 'string' && address.verification?.status === 'verified';
}
