import { z } from 'zod';

export const createEmpresaSchema = z.object({
  cnpj: z
    .string({ required_error: 'CNPJ é obrigatório' })
    .min(14, 'CNPJ deve conter no mínimo 14 caracteres')
    .max(20, 'CNPJ inválido'),
  razaoSocial: z
    .string({ required_error: 'Razão Social é obrigatória' })
    .min(2, 'Razão Social deve ter no mínimo 2 caracteres')
    .max(150, 'Razão Social não pode exceder 150 caracteres'),
});

export const updateEmpresaSchema = z.object({
  cnpj: z.string().min(14).max(20).optional(),
  razaoSocial: z.string().min(2).max(150).optional(),
  ativo: z.boolean().optional(),
});

export type CreateEmpresaInput = z.infer<typeof createEmpresaSchema>;
export type UpdateEmpresaInput = z.infer<typeof updateEmpresaSchema>;
