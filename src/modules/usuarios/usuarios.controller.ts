import { FastifyRequest, FastifyReply } from 'fastify';
import { UsuariosService } from './usuarios.service.js';
import { createUsuarioSchema, updateUsuarioSchema } from './usuarios.schemas.js';

const usuariosService = new UsuariosService();

export class UsuariosController {
  async list(request: FastifyRequest, reply: FastifyReply) {
    try {
      const usuarios = await usuariosService.listAll();
      return reply.status(200).send(usuarios);
    } catch (error: any) {
      return reply.status(500).send({ message: error.message });
    }
  }

  async getById(request: FastifyRequest, reply: FastifyReply) {
    const params = request.params as { id: string };
    const id = Number(params.id);
    if (isNaN(id)) {
      return reply.status(400).send({ message: 'ID inválido.' });
    }

    try {
      const usuario = await usuariosService.getById(id);
      return reply.status(200).send(usuario);
    } catch (error: any) {
      return reply.status(404).send({ message: error.message });
    }
  }

  async create(request: FastifyRequest, reply: FastifyReply) {
    const parseResult = createUsuarioSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        message: 'Dados inválidos.',
        details: parseResult.error.format(),
      });
    }

    try {
      const usuario = await usuariosService.create(parseResult.data);
      return reply.status(201).send(usuario);
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

    const parseResult = updateUsuarioSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        message: 'Dados inválidos.',
        details: parseResult.error.format(),
      });
    }

    try {
      const usuario = await usuariosService.update(id, parseResult.data);
      return reply.status(200).send(usuario);
    } catch (error: any) {
      return reply.status(400).send({ message: error.message });
    }
  }

  async toggleStatus(request: FastifyRequest, reply: FastifyReply) {
    const params = request.params as { id: string };
    const id = Number(params.id);
    if (isNaN(id)) {
      return reply.status(400).send({ message: 'ID inválido.' });
    }

    try {
      const usuario = await usuariosService.toggleStatus(id);
      return reply.status(200).send(usuario);
    } catch (error: any) {
      return reply.status(400).send({ message: error.message });
    }
  }
}
