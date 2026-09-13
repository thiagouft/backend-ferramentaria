import { z } from 'zod';

export const createUsuarioSchema = z.object({
  nome: z.string().min(2, 'Nome deve ter no mínimo 2 caracteres').max(150),
  login: z.string().min(3, 'Login deve ter no mínimo 3 caracteres').max(80),
  senha: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres'),
  email: z.string().email('E-mail inválido').optional().nullable(),
  perfil: z.enum(['MASTER', 'FERRAMENTEIRO']),
  ativo: z.boolean().default(true),
});

export const updateUsuarioSchema = z.object({
  nome: z.string().min(2).max(150).optional(),
  login: z.string().min(3).max(80).optional(),
  senha: z.string().min(6).optional(),
  email: z.string().email().optional().nullable(),
  perfil: z.enum(['MASTER', 'FERRAMENTEIRO']).optional(),
  ativo: z.boolean().optional(),
});

export type CreateUsuarioInput = z.infer<typeof createUsuarioSchema>;
export type UpdateUsuarioInput = z.infer<typeof updateUsuarioSchema>;
