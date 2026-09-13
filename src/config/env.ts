import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL é obrigatória'),
  JWT_SECRET: z.string().min(1, 'JWT_SECRET é obrigatório'),
  PORT: z.coerce.number().default(3333),
  HOST: z.string().default('0.0.0.0'),
  AUTOSYNC_USER: z.string().optional(),
  AUTOSYNC_PASS: z.string().optional(),
});

export const env = envSchema.parse(process.env);
