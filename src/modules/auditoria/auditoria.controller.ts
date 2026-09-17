import { FastifyReply, FastifyRequest } from 'fastify';
import { AuditoriaService } from './auditoria.service.js';

const auditoriaService = new AuditoriaService();

export class AuditoriaController {
  async listLogs(request: FastifyRequest, reply: FastifyReply) {
    const query = request.query as {
      acao?: string;
      entidade?: string;
      idUsuario?: string;
      search?: string;
      page?: string;
      limit?: string;
    };

    const filters = {
      acao: query.acao,
      entidade: query.entidade,
      idUsuario: query.idUsuario ? Number(query.idUsuario) : undefined,
      search: query.search,
      page: query.page ? Number(query.page) : 1,
      limit: query.limit ? Number(query.limit) : 20,
    };

    const result = await auditoriaService.listLogs(filters);
    return reply.status(200).send(result);
  }
}
