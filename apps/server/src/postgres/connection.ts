import { SQL } from 'bun';
import { type BunSQLDatabase, drizzle } from 'drizzle-orm/bun-sql';
import { describeDatabaseUrl } from './database-url.ts';
import * as schema from './schema.ts';

export type GrottoDatabase = BunSQLDatabase<typeof schema>;

export interface GrottoConnection {
    close(): Promise<void>;
    db: GrottoDatabase;
    health(): Promise<boolean>;
}

/** Opens the hosted Server's DML-only PostgreSQL connection. */
export async function connectGrottoDatabase(databaseUrl: string): Promise<GrottoConnection> {
    const client = new SQL(databaseUrl);

    try {
        await client`SELECT 1`;
    } catch (cause) {
        await client.close();
        throw new Error(
            `Failed to connect to Grotto PostgreSQL at ${describeDatabaseUrl(databaseUrl)}.`,
            { cause }
        );
    }

    return {
        close: () => client.close(),
        db: drizzle(client, { schema }),
        health: async () => {
            try {
                await client`SELECT 1`;
                return true;
            } catch {
                return false;
            }
        },
    };
}
