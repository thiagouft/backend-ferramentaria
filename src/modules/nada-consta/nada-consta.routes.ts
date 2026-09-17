import { FastifyInstance } from 'fastify';
import { NadaConstaController } from './nada-consta.controller.js';
import { authMiddleware } from '../../middlewares/auth.middleware.js';

const nadaConstaController = new NadaConstaController();

export async function nadaConstaRoutes(app: FastifyInstance) {
  // Ambas as rotas exigem autenticação do operador/ferramenteiro
  app.addHook('preHandler', authMiddleware);

  // Consulta status de pendências por matrícula ou RFID
  app.get('/:matricula', nadaConstaController.consultarStatus);

  // Download do PDF oficial da Certidão
  app.get('/:matricula/pdf', nadaConstaController.emitirCertidaoPdf);
}
