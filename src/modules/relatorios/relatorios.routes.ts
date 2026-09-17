import { FastifyInstance } from 'fastify';
import { RelatoriosController } from './relatorios.controller.js';
import { authMiddleware } from '../../middlewares/auth.middleware.js';

const relatoriosController = new RelatoriosController();

export async function relatoriosRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authMiddleware);

  // 1. Inventário completo
  app.get('/inventario', relatoriosController.getInventario);

  // 2. Histórico de empréstimos
  app.get('/emprestimos', relatoriosController.getHistoricoEmprestimos);

  // 3. Ferramentas em atraso
  app.get('/atrasos', relatoriosController.getItensComAtraso);

  // 4. Perdas e avarias
  app.get('/avarias', relatoriosController.getPerdasAvarias);
}
