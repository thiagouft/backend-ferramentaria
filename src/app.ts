import fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import { env } from './config/env.js';
import { authRoutes } from './modules/auth/auth.routes.js';
import { ferramentariasRoutes } from './modules/ferramentarias/ferramentarias.routes.js';
import { usuariosRoutes } from './modules/usuarios/usuarios.routes.js';

export function buildApp() {
  const app = fastify({
    logger: {
      level: process.env.NODE_ENV === 'test' ? 'silent' : 'info',
    },
  });

  // CORS
  app.register(cors, {
    origin: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
  });

  // JWT
  app.register(jwt, {
    secret: env.JWT_SECRET,
  });

  // Healthcheck
  app.get('/api/health', async () => {
    return {
      status: 'ok',
      sistema: 'Gestão de Ferramentarias CPRT',
      fase: 1,
      timestamp: new Date().toISOString(),
    };
  });

  // Rotas da aplicação
  app.register(authRoutes, { prefix: '/api/auth' });
  app.register(ferramentariasRoutes, { prefix: '/api/ferramentarias' });
  app.register(usuariosRoutes, { prefix: '/api/usuarios' });

  // Tratamento de erros não capturados
  app.setErrorHandler((error: any, request, reply) => {
    app.log.error(error);
    const statusCode = error.statusCode || 500;
    return reply.status(statusCode).send({
      statusCode,
      error: error.name || 'InternalServerError',
      message: error.message || 'Ocorreu um erro interno no servidor.',
    });
  });

  return app;
}
