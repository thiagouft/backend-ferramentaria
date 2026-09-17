import { z } from 'zod';

export const criarRetiradaSchema = z.object({
  matriculaColaborador: z.string({ required_error: 'Matrícula do colaborador é obrigatória.' }).min(1),
  idFerramentaria: z.number({ required_error: 'ID da ferramentaria é obrigatório.' }).int().positive(),
  itensCodigos: z.array(z.string().min(1), { required_error: 'Lista de ferramentas é obrigatória.' }).min(1, 'Ao menos uma ferramenta deve ser incluída na retirada.'),
  dataPrevisaoDevolucao: z.string().optional().nullable(),
  observacoes: z.string().optional().nullable(),
});

export type CriarRetiradaInput = z.infer<typeof criarRetiradaSchema>;

export const itemDevolucaoSchema = z.object({
  codigoIdentificador: z.string().min(1, 'Código da ferramenta é obrigatório.'),
  condicaoDevolucao: z.enum(['NORMAL', 'AVARIADO']).default('NORMAL'),
  observacaoDevolucao: z.string().optional().nullable(),
});

export const registrarDevolucaoSchema = z.object({
  matriculaColaborador: z.string({ required_error: 'Matrícula do colaborador é obrigatória.' }).min(1),
  idFerramentaria: z.number({ required_error: 'ID da ferramentaria é obrigatório.' }).int().positive(),
  itens: z.array(itemDevolucaoSchema).min(1, 'Ao menos uma ferramenta deve ser devolvida.'),
});

export type RegistrarDevolucaoInput = z.infer<typeof registrarDevolucaoSchema>;

export const queryEmprestimosSchema = z.object({
  idFerramentaria: z.coerce.number().optional(),
  status: z.string().optional(),
  matriculaColaborador: z.string().optional(),
  search: z.string().optional(),
  page: z.coerce.number().min(1).default(1).optional(),
  limit: z.coerce.number().min(1).max(100).default(20).optional(),
});

export type QueryEmprestimosInput = z.infer<typeof queryEmprestimosSchema>;
