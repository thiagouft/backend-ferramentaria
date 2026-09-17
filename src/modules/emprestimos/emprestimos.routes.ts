import { FastifyInstance } from 'fastify';
import { EmprestimosController } from './emprestimos.controller.js';
import { authMiddleware } from '../../middlewares/auth.middleware.js';

const emprestimosController = new EmprestimosController();

export async function emprestimosRoutes(app: FastifyInstance) {
  // Todas as rotas de empréstimos exigem autenticação JWT
  app.addHook('preHandler', authMiddleware);

  app.post('/', emprestimosController.criarRetirada.bind(emprestimosController));
  app.post('/devolucao', emprestimosController.registrarDevolucao.bind(emprestimosController));
  app.get('/custodia/:matricula', emprestimosController.consultarCustodia.bind(emprestimosController));
  app.get('/', emprestimosController.list.bind(emprestimosController));
  app.get('/:id', emprestimosController.getById.bind(emprestimosController));
}
