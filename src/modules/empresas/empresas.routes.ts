import { FastifyInstance } from 'fastify';
import { EmpresasController } from './empresas.controller.js';
import { authMiddleware } from '../../middlewares/auth.middleware.js';

const empresasController = new EmpresasController();

export async function empresasRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authMiddleware);

  app.get('/', empresasController.list.bind(empresasController));
  app.get('/:id', empresasController.getById.bind(empresasController));
  app.post('/', empresasController.create.bind(empresasController));
  app.put('/:id', empresasController.update.bind(empresasController));
  app.delete('/:id', empresasController.delete.bind(empresasController));
}
