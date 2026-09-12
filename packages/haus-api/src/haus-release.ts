import * as z from 'zod';

const exactSemverSchema = z.string().regex(/^\d+\.\d+\.\d+$/u);

export const hausReleaseComponentVersionsSchema = z
    .object({
        agent: exactSemverSchema.nullable(),
        computer: exactSemverSchema.nullable(),
        desktopApp: exactSemverSchema.nullable(),
        ios: z
            .object({
                buildNumber: z.number().int().positive(),
                version: exactSemverSchema,
            })
            .strict()
            .nullable(),
        server: exactSemverSchema.nullable(),
    })
    .strict();

export type HausReleaseComponentVersions = z.infer<typeof hausReleaseComponentVersionsSchema>;

export const hausReleaseSnapshotSchema = z
    .object({
        components: hausReleaseComponentVersionsSchema,
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u),
        schemaVersion: z.literal(1),
        sourceRevision: z.string().regex(/^[0-9a-f]{40}$/u),
        version: exactSemverSchema,
    })
    .strict();

export type HausReleaseSnapshot = z.infer<typeof hausReleaseSnapshotSchema>;

export const hausReleaseDiscoverySchema = z
    .object({
        latest: hausReleaseSnapshotSchema,
        running: z
            .object({
                agent: exactSemverSchema.nullable(),
                server: exactSemverSchema.nullable(),
            })
            .strict(),
    })
    .strict();

export type HausReleaseDiscovery = z.infer<typeof hausReleaseDiscoverySchema>;
