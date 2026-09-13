import bcrypt from 'bcryptjs';
import { prisma } from '../../lib/prisma.js';
import { LoginInput } from './auth.schemas.js';

export class AuthService {
  async authenticate(input: LoginInput) {
    const user = await prisma.usuario.findUnique({
      where: { login: input.login },
    });

    if (!user) {
      throw new Error('Credenciais inválidas.');
    }

    if (!user.ativo) {
      throw new Error('Usuário inativo. Contate o administrador.');
    }

    const passwordMatches = await bcrypt.compare(input.senha, user.senha);
    if (!passwordMatches) {
      throw new Error('Credenciais inválidas.');
    }

    return {
      id: user.id,
      nome: user.nome,
      login: user.login,
      email: user.email,
      perfil: user.perfil as 'MASTER' | 'FERRAMENTEIRO',
    };
  }

  async getMe(userId: number) {
    const user = await prisma.usuario.findUnique({
      where: { id: userId },
      select: {
        id: true,
        nome: true,
        login: true,
        email: true,
        perfil: true,
        ativo: true,
        criadoEm: true,
      },
    });

    if (!user) {
      throw new Error('Usuário não encontrado.');
    }

    return user;
  }
}
