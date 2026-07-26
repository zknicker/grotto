import { SQL } from 'bun';
import { type BunSQLDatabase, drizzle } from 'drizzle-orm/bun-sql';
import { ensureGrottoSchema } from './bootstrap.ts';
import { describeDatabaseUrl } from './database-url.ts';
import * as schema from './schema.ts';

export type GrottoDatabase = BunSQLDatabase<typeof schema>;

export interface GrottoConnection {
    close(): Promise<void>;
    db: GrottoDatabase;
}

/** Opens the hosted Server's PostgreSQL database and sets up its fresh schema. */
export async function connectGrottoDatabase(databaseUrl: string): Promise<GrottoConnection> {
    const client = new SQL(databaseUrl);

    try {
        await ensureGrottoSchema(client);
    } catch (cause) {
        await client.close();
        throw new Error(
            `Failed to prepare the Grotto PostgreSQL schema at ${describeDatabaseUrl(databaseUrl)}.`,
            { cause }
        );
    }

    return {
        close: () => client.close(),
        db: drizzle(client, { schema }),
    };
}
