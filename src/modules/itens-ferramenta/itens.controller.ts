import { FastifyRequest, FastifyReply } from 'fastify';
import { ItensFerramentaService } from './itens.service.js';

const itensService = new ItensFerramentaService();

export class ItensFerramentaController {
  async list(request: FastifyRequest, reply: FastifyReply) {
    const query = request.query as {
      idFerramentaria?: string;
      idFerramenta?: string;
      idEmpresa?: string;
      situacao?: string;
      search?: string;
    };

    const idFerramentaria = query.idFerramentaria ? Number(query.idFerramentaria) : undefined;
    const idFerramenta = query.idFerramenta ? Number(query.idFerramenta) : undefined;
    const idEmpresa = query.idEmpresa ? Number(query.idEmpresa) : undefined;

    try {
      const itens = await itensService.list({
        idFerramentaria,
        idFerramenta,
        idEmpresa,
        situacao: query.situacao,
        search: query.search,
      });
      return reply.status(200).send(itens);
    } catch (error: any) {
      return reply.status(500).send({ message: error.message });
    }
  }

  async getByCodigo(request: FastifyRequest, reply: FastifyReply) {
    const params = request.params as { codigo: string };
    try {
      const item = await itensService.getByCodigo(params.codigo);
      return reply.status(200).send(item);
    } catch (error: any) {
      return reply.status(404).send({ message: error.message });
    }
  }

  async getSvg(request: FastifyRequest, reply: FastifyReply) {
    const params = request.params as { codigo: string };
    try {
      const item = await itensService.getByCodigo(params.codigo);
      reply.header('Content-Type', 'image/svg+xml');
      reply.header('Content-Disposition', `attachment; filename="${item.codigoIdentificador}.svg"`);
      return reply.status(200).send(item.qrcodeSvg);
    } catch (error: any) {
      return reply.status(404).send({ message: error.message });
    }
  }
}
