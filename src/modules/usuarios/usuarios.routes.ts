import { FastifyInstance } from 'fastify';
import { UsuariosController } from './usuarios.controller.js';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { roleMiddleware } from '../../middlewares/role.middleware.js';

const usuariosController = new UsuariosController();

export async function usuariosRoutes(app: FastifyInstance) {
  // Apenas usuários autenticados com perfil MASTER podem acessar a gestão de usuários
  app.addHook('preHandler', authMiddleware);
  app.addHook('preHandler', roleMiddleware(['MASTER']));

  app.get('/', usuariosController.list.bind(usuariosController));
  app.get('/:id', usuariosController.getById.bind(usuariosController));
  app.post('/', usuariosController.create.bind(usuariosController));
  app.put('/:id', usuariosController.update.bind(usuariosController));
  app.patch('/:id/toggle-status', usuariosController.toggleStatus.bind(usuariosController));
}
