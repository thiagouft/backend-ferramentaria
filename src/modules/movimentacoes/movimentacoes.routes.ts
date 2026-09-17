import { FastifyInstance } from 'fastify';
import { MovimentacoesController } from './movimentacoes.controller.js';
import { authMiddleware } from '../../middlewares/auth.middleware.js';

const movimentacoesController = new MovimentacoesController();

export async function movimentacoesRoutes(app: FastifyInstance) {
  // Todas as rotas de movimentação exigem usuário autenticado
  app.addHook('preHandler', authMiddleware);

  app.post('/entrada', movimentacoesController.registrarEntrada.bind(movimentacoesController));
  app.post('/baixa', movimentacoesController.registrarBaixa.bind(movimentacoesController));
  app.get('/', movimentacoesController.list.bind(movimentacoesController));
  app.get('/:id', movimentacoesController.getById.bind(movimentacoesController));
}
