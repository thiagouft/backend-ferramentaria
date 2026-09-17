import { z } from 'zod';

export const createPessoaSchema = z.object({
  matricula: z.string().min(1, 'Matrícula é obrigatória').max(50),
  nome: z.string().min(2, 'Nome deve ter no mínimo 2 caracteres').max(150),
  credenciais: z.string().max(255).optional().nullable(),
  situacao: z.coerce.number().int().min(0).max(1).default(1),
  observacao: z.string().optional().nullable(),
  ativo: z.boolean().default(true),
});

export const updatePessoaSchema = z.object({
  nome: z.string().min(2).max(150).optional(),
  credenciais: z.string().max(255).optional().nullable(),
  situacao: z.coerce.number().int().min(0).max(1).optional(),
  observacao: z.string().optional().nullable(),
  ativo: z.boolean().optional(),
});

export type CreatePessoaInput = z.infer<typeof createPessoaSchema>;
export type UpdatePessoaInput = z.infer<typeof updatePessoaSchema>;
