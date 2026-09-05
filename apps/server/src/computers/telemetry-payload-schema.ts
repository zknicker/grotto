import { z } from 'zod';

const integer = z.string().regex(/^\d{1,20}$/u);
const attributes = z
    .array(
        z.object({
            key: z.string().max(256),
            value: z
                .object({
                    stringValue: z.string().max(1024).optional(),
                    boolValue: z.boolean().optional(),
                    intValue: z
                        .string()
                        .regex(/^-?\d{1,20}$/u)
                        .optional(),
                    doubleValue: z.number().finite().optional(),
                })
                .refine((value) => Object.keys(value).length <= 1)
                .default({}),
        })
    )
    .max(128)
    .default([]);
const resource = z.object({ attributes }).default({ attributes: [] });
const bytes = (length: number) =>
    z
        .instanceof(Uint8Array)
        .refine((value) => value.length === length && value.some((byte) => byte !== 0));
const pointTime = {
    startTimeUnixNano: integer.optional(),
    timeUnixNano: integer,
    attributes,
    flags: z.number().int().min(0).max(1).optional(),
};
const numberPoint = z
    .object({
        ...pointTime,
        asDouble: z.number().finite().optional(),
        asInt: z
            .string()
            .regex(/^-?\d{1,20}$/u)
            .optional(),
    })
    .refine((point) => (point.asDouble === undefined) !== (point.asInt === undefined));
const histogramPoint = z
    .object({
        ...pointTime,
        count: integer,
        sum: z.number().finite().optional(),
        bucketCounts: z.array(integer).max(128).default([]),
        explicitBounds: z.array(z.number().finite()).max(127).default([]),
        min: z.number().finite().optional(),
        max: z.number().finite().optional(),
    })
    .refine(
        (point) =>
            point.bucketCounts.length === point.explicitBounds.length + 1 &&
            point.explicitBounds.every(
                (value, index) => index === 0 || value > (point.explicitBounds[index - 1] ?? value)
            ) &&
            point.bucketCounts.reduce((sum, count) => sum + BigInt(count), 0n) ===
                BigInt(point.count)
    );
const temporality = z.number().int().min(1).max(2);
const metric = z
    .object({
        name: z.string().max(128),
        unit: z.string().max(32).optional(),
        gauge: z.object({ dataPoints: z.array(numberPoint).max(1024) }).optional(),
        sum: z
            .object({
                dataPoints: z.array(numberPoint).max(1024),
                aggregationTemporality: temporality,
                isMonotonic: z.boolean().optional(),
            })
            .optional(),
        histogram: z
            .object({
                dataPoints: z.array(histogramPoint).max(1024),
                aggregationTemporality: temporality,
            })
            .optional(),
    })
    .refine((value) => [value.gauge, value.sum, value.histogram].filter(Boolean).length === 1);

export const tracesPayloadSchema = z.object({
    resourceSpans: z
        .array(
            z.object({
                resource,
                scopeSpans: z
                    .array(
                        z.object({
                            spans: z
                                .array(
                                    z
                                        .object({
                                            traceId: bytes(16),
                                            spanId: bytes(8),
                                            parentSpanId: z
                                                .union([
                                                    bytes(8),
                                                    z
                                                        .instanceof(Uint8Array)
                                                        .refine((value) => value.length === 0),
                                                ])
                                                .optional(),
                                            name: z.string().max(128),
                                            kind: z.number().int().min(0).max(5).optional(),
                                            startTimeUnixNano: integer,
                                            endTimeUnixNano: integer,
                                            attributes,
                                            status: z
                                                .object({ code: z.number().int().min(0).max(2) })
                                                .optional(),
                                            flags: z.number().int().nonnegative().optional(),
                                        })
                                        .refine(
                                            (span) =>
                                                BigInt(span.endTimeUnixNano) >=
                                                BigInt(span.startTimeUnixNano)
                                        )
                                )
                                .max(1024)
                                .default([]),
                        })
                    )
                    .max(32)
                    .default([]),
            })
        )
        .max(32)
        .default([]),
});
export const metricsPayloadSchema = z.object({
    resourceMetrics: z
        .array(
            z.object({
                resource,
                scopeMetrics: z
                    .array(z.object({ metrics: z.array(metric).max(32).default([]) }))
                    .max(32)
                    .default([]),
            })
        )
        .max(32)
        .default([]),
});

export type TelemetryAttributes = z.infer<typeof attributes>;
