import { FastifyReply, FastifyRequest } from 'fastify';
import { NadaConstaService } from './nada-consta.service.js';

const nadaConstaService = new NadaConstaService();

export class NadaConstaController {
  async consultarStatus(request: FastifyRequest, reply: FastifyReply) {
    const { matricula } = request.params as { matricula: string };

    try {
      const resultado = await nadaConstaService.consultarStatus(matricula);
      return reply.status(200).send(resultado);
    } catch (err: any) {
      return reply.status(404).send({ message: err.message || 'Erro ao consultar status.' });
    }
  }

  async emitirCertidaoPdf(request: FastifyRequest, reply: FastifyReply) {
    const { matricula } = request.params as { matricula: string };
    const idUsuarioLogado = (request.user as { id: number })?.id;

    try {
      const pdfBuffer = await nadaConstaService.gerarCertidaoPdf(matricula, idUsuarioLogado);

      reply.header('Content-Type', 'application/pdf');
      reply.header(
        'Content-Disposition',
        `attachment; filename="NadaConsta_${matricula.replace(/[^a-zA-Z0-9_-]/g, '')}_${Date.now()}.pdf"`
      );
      return reply.status(200).send(pdfBuffer);
    } catch (err: any) {
      return reply.status(400).send({ message: err.message || 'Erro ao gerar certidão em PDF.' });
    }
  }
}
