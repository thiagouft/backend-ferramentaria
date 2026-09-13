import bcrypt from 'bcryptjs';
import { prisma } from '../../lib/prisma.js';
import { CreateUsuarioInput, UpdateUsuarioInput } from './usuarios.schemas.js';

export class UsuariosService {
  async listAll() {
    return prisma.usuario.findMany({
      select: {
        id: true,
        nome: true,
        login: true,
        email: true,
        perfil: true,
        ativo: true,
        criadoEm: true,
        atualizadoEm: true,
        _count: {
          select: {
            emprestimos: true,
            movimentacoes: true,
          },
        },
      },
      orderBy: { id: 'asc' },
    });
  }

  async getById(id: number) {
    const user = await prisma.usuario.findUnique({
      where: { id },
      select: {
        id: true,
        nome: true,
        login: true,
        email: true,
        perfil: true,
        ativo: true,
        criadoEm: true,
        atualizadoEm: true,
      },
    });

    if (!user) {
      throw new Error('Usuário não encontrado.');
    }

    return user;
  }

  async create(data: CreateUsuarioInput) {
    const existing = await prisma.usuario.findUnique({
      where: { login: data.login },
    });

    if (existing) {
      throw new Error(`O login '${data.login}' já está em uso.`);
    }

    const hashedPassword = await bcrypt.hash(data.senha, 10);

    const user = await prisma.usuario.create({
      data: {
        nome: data.nome,
        login: data.login,
        senha: hashedPassword,
        email: data.email,
        perfil: data.perfil,
        ativo: data.ativo ?? true,
      },
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

    return user;
  }

  async update(id: number, data: UpdateUsuarioInput) {
    await this.getById(id);

    if (data.login) {
      const conflict = await prisma.usuario.findFirst({
        where: {
          login: data.login,
          NOT: { id },
        },
      });
      if (conflict) {
        throw new Error(`O login '${data.login}' já está em uso por outro usuário.`);
      }
    }

    const updateData: any = {
      ...(data.nome && { nome: data.nome }),
      ...(data.login && { login: data.login }),
      ...(data.email !== undefined && { email: data.email }),
      ...(data.perfil && { perfil: data.perfil }),
      ...(data.ativo !== undefined && { ativo: data.ativo }),
    };

    if (data.senha) {
      updateData.senha = await bcrypt.hash(data.senha, 10);
    }

    return prisma.usuario.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        nome: true,
        login: true,
        email: true,
        perfil: true,
        ativo: true,
        atualizadoEm: true,
      },
    });
  }

  async toggleStatus(id: number) {
    const user = await this.getById(id);

    return prisma.usuario.update({
      where: { id },
      data: { ativo: !user.ativo },
      select: {
        id: true,
        nome: true,
        login: true,
        perfil: true,
        ativo: true,
      },
    });
  }
}
