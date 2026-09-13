import { FastifyInstance } from 'fastify';
import { FerramentariasController } from './ferramentarias.controller.js';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { roleMiddleware } from '../../middlewares/role.middleware.js';

const ferramentariasController = new FerramentariasController();

export async function ferramentariasRoutes(app: FastifyInstance) {
  // Todas as rotas de ferramentarias requerem autenticação
  app.addHook('preHandler', authMiddleware);

  // Leitura permitida para MASTER e FERRAMENTEIRO
  app.get('/', ferramentariasController.list.bind(ferramentariasController));
  app.get('/:id', ferramentariasController.getById.bind(ferramentariasController));

  // Modificações permitidas exclusivamente para MASTER
  app.post(
    '/',
    { preHandler: [roleMiddleware(['MASTER'])] },
    ferramentariasController.create.bind(ferramentariasController)
  );

  app.put(
    '/:id',
    { preHandler: [roleMiddleware(['MASTER'])] },
    ferramentariasController.update.bind(ferramentariasController)
  );

  app.patch(
    '/:id/toggle-status',
    { preHandler: [roleMiddleware(['MASTER'])] },
    ferramentariasController.toggleStatus.bind(ferramentariasController)
  );

  app.delete(
    '/:id',
    { preHandler: [roleMiddleware(['MASTER'])] },
    ferramentariasController.delete.bind(ferramentariasController)
  );
}
