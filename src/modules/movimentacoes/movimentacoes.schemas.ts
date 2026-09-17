import { z } from 'zod';

export const registrarEntradaSchema = z.object({
  idFerramenta: z.number({ required_error: 'ID da ferramenta é obrigatório.' }).int().positive(),
  idFerramentaria: z.number({ required_error: 'ID da ferramentaria é obrigatório.' }).int().positive(),
  quantidade: z.number({ required_error: 'Quantidade é obrigatória.' }).int().min(1, 'A quantidade mínima de entrada é 1.'),
  matriculaResponsavel: z.string({ required_error: 'Matrícula do responsável pela entrega é obrigatória.' }).min(1, 'Matrícula não pode ser vazia.'),
  motivo: z.string().optional().nullable(),
});

export type RegistrarEntradaInput = z.infer<typeof registrarEntradaSchema>;

export const registrarBaixaSchema = z.object({
  idItemFerramenta: z.string({ required_error: 'ID do item é obrigatório.' }).min(1, 'ID do item não pode ser vazio.'),
  tipo: z.enum(['AVARIADO', 'BAIXADO', 'EXTRAVIO'], {
    required_error: 'Tipo de baixa é obrigatório (AVARIADO, BAIXADO ou EXTRAVIO).',
  }),
  motivo: z.string({ required_error: 'A justificativa ou laudo da avaria é obrigatório.' }).min(3, 'A justificativa deve ter ao menos 3 caracteres.'),
});

export type RegistrarBaixaInput = z.infer<typeof registrarBaixaSchema>;

export const queryMovimentacoesSchema = z.object({
  tipo: z.string().optional(),
  idFerramentaria: z.coerce.number().optional(),
  idFerramenta: z.coerce.number().optional(),
  search: z.string().optional(),
  page: z.coerce.number().min(1).default(1).optional(),
  limit: z.coerce.number().min(1).max(100).default(20).optional(),
});

export type QueryMovimentacoesInput = z.infer<typeof queryMovimentacoesSchema>;
