import { z } from 'zod';

export const createFerramentariaSchema = z.object({
  descricao: z.string().min(2, 'Descrição deve ter no mínimo 2 caracteres').max(120),
  localizacao: z.string().max(200).optional().nullable(),
  ativo: z.boolean().default(true),
});

export const updateFerramentariaSchema = z.object({
  descricao: z.string().min(2).max(120).optional(),
  localizacao: z.string().max(200).optional().nullable(),
  ativo: z.boolean().optional(),
});

export type CreateFerramentariaInput = z.infer<typeof createFerramentariaSchema>;
export type UpdateFerramentariaInput = z.infer<typeof updateFerramentariaSchema>;
