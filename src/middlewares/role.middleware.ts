import { FastifyRequest, FastifyReply } from 'fastify';

export function roleMiddleware(allowedRoles: ('MASTER' | 'FERRAMENTEIRO')[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user;
    if (!user || !allowedRoles.includes(user.perfil as any)) {
      return reply.status(403).send({
        statusCode: 403,
        error: 'Forbidden',
        message: 'Acesso negado: seu perfil não possui permissão para esta operação.',
      });
    }
  };
}
