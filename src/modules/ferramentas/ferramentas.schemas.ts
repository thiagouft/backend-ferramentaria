import { z } from 'zod';

export const createFerramentaSchema = z.object({
  descricao: z.string().min(2, 'Descrição deve ter no mínimo 2 caracteres').max(150),
  valorUnitario: z.coerce.number().positive('Valor unitário deve ser maior que zero'),
  idFerramentaria: z.coerce.number().int().positive('Ferramentaria é obrigatória'),
  idEmpresa: z.coerce.number().int().positive('Empresa proprietária é obrigatória'),
  quantidadeInicial: z.coerce.number().int().min(0).max(500).default(0),
});

export const updateFerramentaSchema = z.object({
  descricao: z.string().min(2).max(150).optional(),
  valorUnitario: z.coerce.number().positive().optional(),
  idEmpresa: z.coerce.number().int().positive().optional(),
  idFerramentaria: z.coerce.number().int().positive().optional(),
});

export const addExemplaresSchema = z.object({
  quantidade: z.coerce.number().int().min(1).max(200),
  observacao: z.string().optional().nullable(),
});

export type CreateFerramentaInput = z.infer<typeof createFerramentaSchema>;
export type UpdateFerramentaInput = z.infer<typeof updateFerramentaSchema>;
export type AddExemplaresInput = z.infer<typeof addExemplaresSchema>;
