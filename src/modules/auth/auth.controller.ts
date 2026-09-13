import { FastifyRequest, FastifyReply } from 'fastify';
import { AuthService } from './auth.service.js';
import { loginSchema } from './auth.schemas.js';

const authService = new AuthService();

export class AuthController {
  async login(request: FastifyRequest, reply: FastifyReply) {
    const parseResult = loginSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Dados de entrada inválidos.',
        details: parseResult.error.format(),
      });
    }

    try {
      const user = await authService.authenticate(parseResult.data);
      
      // Token assinado pelo Fastify JWT com expiração de 8h (compatível com turno de canteiro de obras)
      const token = request.server.jwt.sign(
        {
          id: user.id,
          nome: user.nome,
          login: user.login,
          perfil: user.perfil,
        },
        { expiresIn: '8h' }
      );

      return reply.status(200).send({
        token,
        user,
      });
    } catch (error: any) {
      return reply.status(401).send({
        statusCode: 401,
        error: 'Unauthorized',
        message: error.message || 'Erro na autenticação.',
      });
    }
  }

  async me(request: FastifyRequest, reply: FastifyReply) {
    try {
      const user = await authService.getMe(request.user.id);
      return reply.status(200).send({ user });
    } catch (error: any) {
      return reply.status(404).send({
        statusCode: 404,
        error: 'Not Found',
        message: error.message || 'Usuário não encontrado.',
      });
    }
  }
}
