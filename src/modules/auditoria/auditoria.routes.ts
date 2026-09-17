import { FastifyInstance } from 'fastify';
import { AuditoriaController } from './auditoria.controller.js';
import { authMiddleware } from '../../middlewares/auth.middleware.js';

const auditoriaController = new AuditoriaController();

export async function auditoriaRoutes(app: FastifyInstance) {
  // Todas as rotas de auditoria exigem autenticação JWT
  app.addHook('preHandler', authMiddleware);

  app.get('/logs', auditoriaController.listLogs.bind(auditoriaController));
}
