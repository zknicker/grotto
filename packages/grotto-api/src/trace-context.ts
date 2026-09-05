import * as z from 'zod';

export const traceCarrierSchema = z
    .object({
        traceparent: z.string().regex(/^00-[0-9a-f]{32}-[0-9a-f]{16}-[0-9a-f]{2}$/u),
    })
    .strict();
