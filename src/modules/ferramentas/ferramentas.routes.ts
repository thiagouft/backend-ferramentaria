import { FastifyInstance } from 'fastify';
import { FerramentasController } from './ferramentas.controller.js';
import { authMiddleware } from '../../middlewares/auth.middleware.js';

const ferramentasController = new FerramentasController();

export async function ferramentasRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authMiddleware);

  app.get('/', ferramentasController.list.bind(ferramentasController));
  app.get('/:id', ferramentasController.getById.bind(ferramentasController));
  app.post('/', ferramentasController.create.bind(ferramentasController));
  app.put('/:id', ferramentasController.update.bind(ferramentasController));
  app.post('/:id/exemplares', ferramentasController.addExemplares.bind(ferramentasController));
  app.delete('/:id', ferramentasController.delete.bind(ferramentasController));
}
