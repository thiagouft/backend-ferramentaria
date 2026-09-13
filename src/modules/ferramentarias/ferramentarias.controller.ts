import { FastifyRequest, FastifyReply } from 'fastify';
import { FerramentariasService } from './ferramentarias.service.js';
import {
  createFerramentariaSchema,
  updateFerramentariaSchema,
} from './ferramentarias.schemas.js';

const ferramentariasService = new FerramentariasService();

export class FerramentariasController {
  async list(request: FastifyRequest, reply: FastifyReply) {
    const isMaster = request.user?.perfil === 'MASTER';
    const ferramentarias = await ferramentariasService.listAll(isMaster);
    return reply.status(200).send(ferramentarias);
  }

  async getById(request: FastifyRequest, reply: FastifyReply) {
    const params = request.params as { id: string };
    const id = Number(params.id);
    if (isNaN(id)) {
      return reply.status(400).send({ message: 'ID inválido.' });
    }

    try {
      const ferramentaria = await ferramentariasService.getById(id);
      return reply.status(200).send(ferramentaria);
    } catch (error: any) {
      return reply.status(404).send({ message: error.message });
    }
  }

  async create(request: FastifyRequest, reply: FastifyReply) {
    const parseResult = createFerramentariaSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        message: 'Dados inválidos.',
        details: parseResult.error.format(),
      });
    }

    try {
      const created = await ferramentariasService.create(parseResult.data);
      return reply.status(201).send(created);
    } catch (error: any) {
      return reply.status(400).send({ message: error.message });
    }
  }

  async update(request: FastifyRequest, reply: FastifyReply) {
    const params = request.params as { id: string };
    const id = Number(params.id);
    if (isNaN(id)) {
      return reply.status(400).send({ message: 'ID inválido.' });
    }

    const parseResult = updateFerramentariaSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        message: 'Dados inválidos.',
        details: parseResult.error.format(),
      });
    }

    try {
      const updated = await ferramentariasService.update(id, parseResult.data);
      return reply.status(200).send(updated);
    } catch (error: any) {
      return reply.status(404).send({ message: error.message });
    }
  }

  async toggleStatus(request: FastifyRequest, reply: FastifyReply) {
    const params = request.params as { id: string };
    const id = Number(params.id);
    if (isNaN(id)) {
      return reply.status(400).send({ message: 'ID inválido.' });
    }

    try {
      const updated = await ferramentariasService.toggleStatus(id);
      return reply.status(200).send(updated);
    } catch (error: any) {
      return reply.status(404).send({ message: error.message });
    }
  }

  async delete(request: FastifyRequest, reply: FastifyReply) {
    const params = request.params as { id: string };
    const id = Number(params.id);
    if (isNaN(id)) {
      return reply.status(400).send({ message: 'ID inválido.' });
    }

    try {
      const deleted = await ferramentariasService.delete(id);
      return reply.status(200).send({ message: 'Ferramentaria inativada com sucesso.', ferramentaria: deleted });
    } catch (error: any) {
      return reply.status(404).send({ message: error.message });
    }
  }
}
