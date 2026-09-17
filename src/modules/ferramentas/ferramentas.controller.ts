import { FastifyRequest, FastifyReply } from 'fastify';
import { FerramentasService } from './ferramentas.service.js';
import {
  createFerramentaSchema,
  updateFerramentaSchema,
  addExemplaresSchema,
} from './ferramentas.schemas.js';

const ferramentasService = new FerramentasService();

export class FerramentasController {
  async list(request: FastifyRequest, reply: FastifyReply) {
    const query = request.query as {
      idFerramentaria?: string;
      idEmpresa?: string;
      search?: string;
    };

    const idFerramentaria = query.idFerramentaria ? Number(query.idFerramentaria) : undefined;
    const idEmpresa = query.idEmpresa ? Number(query.idEmpresa) : undefined;

    try {
      const ferramentas = await ferramentasService.list({
        idFerramentaria,
        idEmpresa,
        search: query.search,
      });
      return reply.status(200).send(ferramentas);
    } catch (error: any) {
      return reply.status(500).send({ message: error.message });
    }
  }

  async getById(request: FastifyRequest, reply: FastifyReply) {
    const params = request.params as { id: string };
    const id = Number(params.id);
    if (isNaN(id)) return reply.status(400).send({ message: 'ID inválido.' });

    try {
      const ferramenta = await ferramentasService.getById(id);
      return reply.status(200).send(ferramenta);
    } catch (error: any) {
      return reply.status(404).send({ message: error.message });
    }
  }

  async create(request: FastifyRequest, reply: FastifyReply) {
    const parseResult = createFerramentaSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        message: 'Dados inválidos.',
        details: parseResult.error.format(),
      });
    }

    try {
      const ferramenta = await ferramentasService.create(parseResult.data);
      return reply.status(201).send(ferramenta);
    } catch (error: any) {
      return reply.status(400).send({ message: error.message });
    }
  }

  async update(request: FastifyRequest, reply: FastifyReply) {
    const params = request.params as { id: string };
    const id = Number(params.id);
    if (isNaN(id)) return reply.status(400).send({ message: 'ID inválido.' });

    const parseResult = updateFerramentaSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        message: 'Dados inválidos.',
        details: parseResult.error.format(),
      });
    }

    try {
      const updated = await ferramentasService.update(id, parseResult.data);
      return reply.status(200).send(updated);
    } catch (error: any) {
      return reply.status(400).send({ message: error.message });
    }
  }

  async addExemplares(request: FastifyRequest, reply: FastifyReply) {
    const params = request.params as { id: string };
    const id = Number(params.id);
    if (isNaN(id)) return reply.status(400).send({ message: 'ID inválido.' });

    const parseResult = addExemplaresSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        message: 'Dados inválidos.',
        details: parseResult.error.format(),
      });
    }

    try {
      const result = await ferramentasService.addExemplares(
        id,
        parseResult.data.quantidade,
        parseResult.data.observacao
      );
      return reply.status(201).send(result);
    } catch (error: any) {
      return reply.status(400).send({ message: error.message });
    }
  }

  async delete(request: FastifyRequest, reply: FastifyReply) {
    const params = request.params as { id: string };
    const id = Number(params.id);
    if (isNaN(id)) return reply.status(400).send({ message: 'ID inválido.' });

    try {
      const result = await ferramentasService.delete(id);
      return reply.status(200).send(result);
    } catch (error: any) {
      return reply.status(400).send({ message: error.message });
    }
  }
}
