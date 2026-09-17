import { FastifyInstance } from 'fastify';
import { PessoasController } from './pessoas.controller.js';
import { authMiddleware } from '../../middlewares/auth.middleware.js';

const pessoasController = new PessoasController();

export async function pessoasRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authMiddleware);

  app.get('/', pessoasController.list.bind(pessoasController));
  app.get('/sync-info', pessoasController.getSyncInfo.bind(pessoasController));
  app.get('/:matricula', pessoasController.getByMatricula.bind(pessoasController));
  app.post('/', pessoasController.create.bind(pessoasController));
  app.put('/:matricula', pessoasController.update.bind(pessoasController));
  app.patch('/:matricula/toggle-status', pessoasController.toggleStatus.bind(pessoasController));
  app.post('/upload-xls', pessoasController.uploadXLS.bind(pessoasController));
  app.post('/sync-dimep', pessoasController.syncDimep.bind(pessoasController));
}
