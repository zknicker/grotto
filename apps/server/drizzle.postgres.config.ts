import { defineConfig } from 'drizzle-kit';

export default defineConfig({
    dialect: 'postgresql',
    out: './drizzle/postgres',
    schema: './src/postgres/schema.ts',
    strict: true,
    verbose: true,
});
