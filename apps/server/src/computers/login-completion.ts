import { eq } from 'drizzle-orm';
import type { GrottoDatabase } from '../postgres/connection.ts';
import { computerLoginSessionsTable } from '../postgres/schema.ts';
import { computerLoginError } from './login-errors.ts';
import { hashComputerSecret } from './service.ts';

export async function completeComputerLogin(db: GrottoDatabase, input: { accessToken: string }) {
    if (!/^gcl_at_[A-Za-z0-9_-]{43}$/u.test(input.accessToken)) {
        throw computerLoginError('computer_login_malformed');
    }
    const [session] = await db
        .update(computerLoginSessionsTable)
        .set({ storedAt: new Date() })
        .where(
            eq(computerLoginSessionsTable.accessTokenHash, hashComputerSecret(input.accessToken))
        )
        .returning({ id: computerLoginSessionsTable.id });
    if (!session) {
        throw computerLoginError('computer_login_not_found');
    }
    return { status: 'completed' as const };
}
