import { FastifyInstance } from 'fastify';
import { AuthController } from './auth.controller.js';
import { authMiddleware } from '../../middlewares/auth.middleware.js';

const authController = new AuthController();

export async function authRoutes(app: FastifyInstance) {
  app.post('/login', authController.login.bind(authController));

  app.get(
    '/me',
    { preHandler: [authMiddleware] },
    authController.me.bind(authController)
  );
}
