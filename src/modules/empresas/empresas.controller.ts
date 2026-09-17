import { FastifyRequest, FastifyReply } from 'fastify';
import { EmpresasService } from './empresas.service.js';
import { createEmpresaSchema, updateEmpresaSchema } from './empresas.schemas.js';

const empresasService = new EmpresasService();

export class EmpresasController {
  async list(request: FastifyRequest, reply: FastifyReply) {
    const query = request.query as { apenasAtivas?: string; search?: string };
    try {
      const empresas = await empresasService.list({
        apenasAtivas: query.apenasAtivas === 'true',
        search: query.search,
      });
      return reply.status(200).send(empresas);
    } catch (error: any) {
      return reply.status(500).send({ message: error.message });
    }
  }

  async getById(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    try {
      const empresa = await empresasService.getById(Number(id));
      return reply.status(200).send(empresa);
    } catch (error: any) {
      return reply.status(404).send({ message: error.message });
    }
  }

  async create(request: FastifyRequest, reply: FastifyReply) {
    try {
      const data = createEmpresaSchema.parse(request.body);
      const empresa = await empresasService.create(data);
      return reply.status(201).send(empresa);
    } catch (error: any) {
      return reply.status(400).send({ message: error.message });
    }
  }

  async update(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    try {
      const data = updateEmpresaSchema.parse(request.body);
      const empresa = await empresasService.update(Number(id), data);
      return reply.status(200).send(empresa);
    } catch (error: any) {
      return reply.status(400).send({ message: error.message });
    }
  }

  async delete(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    try {
      const result = await empresasService.delete(Number(id));
      return reply.status(200).send(result);
    } catch (error: any) {
      return reply.status(400).send({ message: error.message });
    }
  }
}
