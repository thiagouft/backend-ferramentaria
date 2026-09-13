import { FastifyRequest, FastifyReply } from 'fastify';

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: {
      id: number;
      nome: string;
      login: string;
      perfil: 'MASTER' | 'FERRAMENTEIRO';
    };
    user: {
      id: number;
      nome: string;
      login: string;
      perfil: 'MASTER' | 'FERRAMENTEIRO';
    };
  }
}

export async function authMiddleware(request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify();
  } catch (err) {
    return reply.status(401).send({
      statusCode: 401,
      error: 'Unauthorized',
      message: 'Token de autenticação ausente ou inválido.',
    });
  }
}
