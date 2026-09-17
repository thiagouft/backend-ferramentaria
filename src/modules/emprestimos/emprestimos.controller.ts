import { FastifyReply, FastifyRequest } from 'fastify';
import { EmprestimosService } from './emprestimos.service.js';
import {
  criarRetiradaSchema,
  registrarDevolucaoSchema,
  queryEmprestimosSchema,
} from './emprestimos.schemas.js';

const emprestimosService = new EmprestimosService();

export class EmprestimosController {
  async criarRetirada(request: FastifyRequest, reply: FastifyReply) {
    const data = criarRetiradaSchema.parse(request.body);
    const idUsuarioLogado = (request.user as { id: number }).id;

    const clientInfo = {
      ip: request.ip,
      dispositivo: request.headers['user-agent'] as string | undefined,
    };

    try {
      const emprestimo = await emprestimosService.criarRetirada(
        data,
        idUsuarioLogado,
        clientInfo
      );
      return reply.status(201).send(emprestimo);
    } catch (err: any) {
      return reply.status(400).send({ message: err.message || 'Erro ao criar retirada.' });
    }
  }

  async registrarDevolucao(request: FastifyRequest, reply: FastifyReply) {
    const data = registrarDevolucaoSchema.parse(request.body);
    const idUsuarioLogado = (request.user as { id: number }).id;

    const clientInfo = {
      ip: request.ip,
      dispositivo: request.headers['user-agent'] as string | undefined,
    };

    try {
      const resultado = await emprestimosService.registrarDevolucao(
        data,
        idUsuarioLogado,
        clientInfo
      );
      return reply.status(200).send(resultado);
    } catch (err: any) {
      return reply.status(400).send({ message: err.message || 'Erro ao registrar devolução.' });
    }
  }

  async consultarCustodia(request: FastifyRequest, reply: FastifyReply) {
    const { matricula } = request.params as { matricula: string };
    try {
      const custodia = await emprestimosService.consultarCustodia(matricula);
      return reply.status(200).send(custodia);
    } catch (err: any) {
      return reply.status(404).send({ message: err.message || 'Erro ao consultar custódia.' });
    }
  }

  async list(request: FastifyRequest, reply: FastifyReply) {
    const filters = queryEmprestimosSchema.parse(request.query);
    const result = await emprestimosService.list(filters);
    return reply.status(200).send(result);
  }

  async getById(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    try {
      const emprestimo = await emprestimosService.getById(id);
      return reply.status(200).send(emprestimo);
    } catch (err: any) {
      return reply.status(404).send({ message: err.message || 'Empréstimo não encontrado.' });
    }
  }
}
