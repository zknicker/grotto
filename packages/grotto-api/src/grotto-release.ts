import * as z from 'zod';

const exactSemverSchema = z.string().regex(/^\d+\.\d+\.\d+$/u);

export const grottoReleaseComponentVersionsSchema = z
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

export type GrottoReleaseComponentVersions = z.infer<typeof grottoReleaseComponentVersionsSchema>;

export const grottoReleaseSnapshotSchema = z
    .object({
        components: grottoReleaseComponentVersionsSchema,
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u),
        schemaVersion: z.literal(1),
        sourceRevision: z.string().regex(/^[0-9a-f]{40}$/u),
        version: exactSemverSchema,
    })
    .strict();

export type GrottoReleaseSnapshot = z.infer<typeof grottoReleaseSnapshotSchema>;

export const grottoReleaseDiscoverySchema = z
    .object({
        latest: grottoReleaseSnapshotSchema,
        running: z
            .object({
                agent: exactSemverSchema.nullable(),
                server: exactSemverSchema.nullable(),
            })
            .strict(),
    })
    .strict();

export type GrottoReleaseDiscovery = z.infer<typeof grottoReleaseDiscoverySchema>;
