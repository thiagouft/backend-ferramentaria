import fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import multipart from '@fastify/multipart';
import { env } from './config/env.js';
import { authRoutes } from './modules/auth/auth.routes.js';
import { ferramentariasRoutes } from './modules/ferramentarias/ferramentarias.routes.js';
import { usuariosRoutes } from './modules/usuarios/usuarios.routes.js';
import { pessoasRoutes } from './modules/pessoas/pessoas.routes.js';
import { ferramentasRoutes } from './modules/ferramentas/ferramentas.routes.js';
import { itensFerramentaRoutes } from './modules/itens-ferramenta/itens.routes.js';
import { movimentacoesRoutes } from './modules/movimentacoes/movimentacoes.routes.js';
import { auditoriaRoutes } from './modules/auditoria/auditoria.routes.js';
import { emprestimosRoutes } from './modules/emprestimos/emprestimos.routes.js';
import { nadaConstaRoutes } from './modules/nada-consta/nada-consta.routes.js';
import { relatoriosRoutes } from './modules/relatorios/relatorios.routes.js';
import { empresasRoutes } from './modules/empresas/empresas.routes.js';

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

  // Upload multipart de arquivos (planilhas Excel)
  app.register(multipart, {
    limits: {
      fileSize: 50 * 1024 * 1024, // 50MB
    },
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
      fasesAtivas: [1, 2, 3, 4, 5, 6, 7],
      timestamp: new Date().toISOString(),
    };
  });

  // Rotas da aplicação
  app.register(authRoutes, { prefix: '/api/auth' });
  app.register(ferramentariasRoutes, { prefix: '/api/ferramentarias' });
  app.register(usuariosRoutes, { prefix: '/api/usuarios' });
  app.register(pessoasRoutes, { prefix: '/api/pessoas' });
  app.register(ferramentasRoutes, { prefix: '/api/ferramentas' });
  app.register(itensFerramentaRoutes, { prefix: '/api/itens-ferramenta' });
  app.register(movimentacoesRoutes, { prefix: '/api/movimentacoes' });
  app.register(auditoriaRoutes, { prefix: '/api/auditoria' });
  app.register(emprestimosRoutes, { prefix: '/api/emprestimos' });
  app.register(nadaConstaRoutes, { prefix: '/api/nada-consta' });
  app.register(relatoriosRoutes, { prefix: '/api/relatorios' });
  app.register(empresasRoutes, { prefix: '/api/empresas' });

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
