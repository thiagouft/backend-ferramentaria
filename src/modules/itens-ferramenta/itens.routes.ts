import { FastifyInstance } from 'fastify';
import { ItensFerramentaController } from './itens.controller.js';
import { authMiddleware } from '../../middlewares/auth.middleware.js';

const itensController = new ItensFerramentaController();

export async function itensFerramentaRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authMiddleware);

  app.get('/', itensController.list.bind(itensController));
  app.get('/:codigo', itensController.getByCodigo.bind(itensController));
  app.get('/:codigo/svg', itensController.getSvg.bind(itensController));
}
