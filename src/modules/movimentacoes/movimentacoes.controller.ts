import { FastifyReply, FastifyRequest } from 'fastify';
import { MovimentacoesService } from './movimentacoes.service.js';
import {
  registrarEntradaSchema,
  registrarBaixaSchema,
  queryMovimentacoesSchema,
} from './movimentacoes.schemas.js';

const movimentacoesService = new MovimentacoesService();

export class MovimentacoesController {
  async registrarEntrada(request: FastifyRequest, reply: FastifyReply) {
    const data = registrarEntradaSchema.parse(request.body);
    const idUsuarioLogado = (request.user as { id: number }).id;

    const clientInfo = {
      ip: request.ip,
      dispositivo: request.headers['user-agent'] as string | undefined,
    };

    try {
      const result = await movimentacoesService.registrarEntrada(
        data,
        idUsuarioLogado,
        clientInfo
      );
      return reply.status(201).send(result);
    } catch (err: any) {
      return reply.status(400).send({ message: err.message || 'Erro ao registrar entrada.' });
    }
  }

  async registrarBaixa(request: FastifyRequest, reply: FastifyReply) {
    const data = registrarBaixaSchema.parse(request.body);
    const idUsuarioLogado = (request.user as { id: number }).id;

    const clientInfo = {
      ip: request.ip,
      dispositivo: request.headers['user-agent'] as string | undefined,
    };

    try {
      const result = await movimentacoesService.registrarBaixa(
        data,
        idUsuarioLogado,
        clientInfo
      );
      return reply.status(200).send(result);
    } catch (err: any) {
      return reply.status(400).send({ message: err.message || 'Erro ao registrar baixa.' });
    }
  }

  async list(request: FastifyRequest, reply: FastifyReply) {
    const filters = queryMovimentacoesSchema.parse(request.query);
    const result = await movimentacoesService.list(filters);
    return reply.status(200).send(result);
  }

  async getById(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    try {
      const movimentacao = await movimentacoesService.getById(Number(id));
      return reply.status(200).send(movimentacao);
    } catch (err: any) {
      return reply.status(404).send({ message: err.message || 'Movimentação não encontrada.' });
    }
  }
}
