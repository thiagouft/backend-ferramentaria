import { prisma } from '../../lib/prisma.js';
import { CreatePessoaInput, UpdatePessoaInput } from './pessoas.schemas.js';

export class PessoasService {
  async listAll(filters: { search?: string; situacao?: number; ativo?: boolean; incluirInativos?: boolean }) {
    const where: any = {};

    if (filters.ativo !== undefined) {
      where.ativo = filters.ativo;
    } else if (!filters.incluirInativos) {
      where.ativo = true;
    }

    if (filters.situacao !== undefined && !isNaN(filters.situacao)) {
      where.situacao = filters.situacao;
    }

    if (filters.search) {
      const s = filters.search.trim();
      where.OR = [
        { matricula: { contains: s } },
        { nome: { contains: s } },
        { credenciais: { contains: s } },
      ];
    }

    return prisma.pessoa.findMany({
      where,
      orderBy: { nome: 'asc' },
      include: {
        _count: {
          select: {
            emprestimos: {
              where: {
                status: 'ABERTO',
              },
            },
          },
        },
      },
    });
  }

  async getByMatricula(matricula: string) {
    const pessoa = await prisma.pessoa.findUnique({
      where: { matricula },
      include: {
        emprestimos: {
          where: { status: 'ABERTO' },
          include: {
            itens: {
              include: {
                itemFerramenta: {
                  include: {
                    ferramenta: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!pessoa) {
      throw new Error('Colaborador não encontrado.');
    }

    return pessoa;
  }

  async create(data: CreatePessoaInput) {
    const existing = await prisma.pessoa.findUnique({
      where: { matricula: data.matricula },
    });

    if (existing) {
      throw new Error(`A matrícula '${data.matricula}' já está cadastrada para '${existing.nome}'.`);
    }

    return prisma.pessoa.create({
      data: {
        matricula: data.matricula,
        nome: data.nome,
        credenciais: data.credenciais || null,
        situacao: data.situacao ?? 1,
        observacao: data.observacao || null,
        ativo: data.ativo ?? true,
        dataUltimaSincronizacao: new Date(),
      },
    });
  }

  async update(matricula: string, data: UpdatePessoaInput) {
    await this.getByMatricula(matricula);

    return prisma.pessoa.update({
      where: { matricula },
      data: {
        ...(data.nome && { nome: data.nome }),
        ...(data.credenciais !== undefined && { credenciais: data.credenciais }),
        ...(data.situacao !== undefined && { situacao: data.situacao }),
        ...(data.observacao !== undefined && { observacao: data.observacao }),
        ...(data.ativo !== undefined && { ativo: data.ativo }),
      },
    });
  }

  async toggleStatus(matricula: string) {
    const pessoa = await this.getByMatricula(matricula);

    return prisma.pessoa.update({
      where: { matricula },
      data: { ativo: !pessoa.ativo },
    });
  }

  async getLastSyncInfo() {
    const lastPessoa = await prisma.pessoa.findFirst({
      orderBy: { dataUltimaSincronizacao: 'desc' },
      select: { dataUltimaSincronizacao: true },
    });

    const totalAtivos = await prisma.pessoa.count({ where: { ativo: true } });
    const totalBloqueados = await prisma.pessoa.count({ where: { ativo: true, situacao: 0 } });
    const totalLiberados = await prisma.pessoa.count({ where: { ativo: true, situacao: 1 } });

    return {
      ultimaSincronizacao: lastPessoa?.dataUltimaSincronizacao || null,
      totalAtivos,
      totalLiberados,
      totalBloqueados,
    };
  }
}
