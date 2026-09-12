import * as z from 'zod';

export const idSchema = z.string().trim().min(1);
export const timestampSchema = z.iso.datetime({ offset: true });
