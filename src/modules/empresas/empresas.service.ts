import { prisma } from '../../lib/prisma.js';
import { CreateEmpresaInput, UpdateEmpresaInput } from './empresas.schemas.js';

export class EmpresasService {
  async list(filters?: { apenasAtivas?: boolean; search?: string }) {
    const where: any = {};

    if (filters?.apenasAtivas) {
      where.ativo = true;
    }

    if (filters?.search) {
      const s = filters.search.trim();
      where.OR = [
        { razaoSocial: { contains: s } },
        { cnpj: { contains: s } },
      ];
    }

    const empresas = await prisma.empresa.findMany({
      where,
      orderBy: { id: 'asc' },
      include: {
        _count: {
          select: {
            ferramentas: true,
          },
        },
      },
    });

    return empresas.map((emp) => ({
      ...emp,
      totalFerramentas: emp._count.ferramentas,
    }));
  }

  async getById(id: number) {
    const empresa = await prisma.empresa.findUnique({
      where: { id },
      include: {
        ferramentas: {
          include: {
            _count: {
              select: { itens: true },
            },
          },
        },
        _count: {
          select: { ferramentas: true },
        },
      },
    });

    if (!empresa) {
      throw new Error('Empresa não encontrada.');
    }

    return {
      ...empresa,
      totalFerramentas: empresa._count.ferramentas,
    };
  }

  async create(data: CreateEmpresaInput) {
    const cnpjLimpo = data.cnpj.trim();
    const razaoSocialLimpa = data.razaoSocial.trim();

    const existing = await prisma.empresa.findUnique({
      where: { cnpj: cnpjLimpo },
    });

    if (existing) {
      throw new Error(`Já existe uma empresa cadastrada com o CNPJ ${cnpjLimpo}.`);
    }

    return prisma.empresa.create({
      data: {
        cnpj: cnpjLimpo,
        razaoSocial: razaoSocialLimpa,
        ativo: true,
      },
    });
  }

  async update(id: number, data: UpdateEmpresaInput) {
    await this.getById(id);

    if (data.cnpj) {
      const existing = await prisma.empresa.findFirst({
        where: {
          cnpj: data.cnpj.trim(),
          NOT: { id },
        },
      });

      if (existing) {
        throw new Error(`Já existe outra empresa cadastrada com o CNPJ ${data.cnpj}.`);
      }
    }

    return prisma.empresa.update({
      where: { id },
      data: {
        ...(data.cnpj && { cnpj: data.cnpj.trim() }),
        ...(data.razaoSocial && { razaoSocial: data.razaoSocial.trim() }),
        ...(data.ativo !== undefined && { ativo: data.ativo }),
      },
    });
  }

  async delete(id: number) {
    const empresa = await this.getById(id);

    if (empresa.totalFerramentas > 0) {
      // Inativa em vez de deletar para não quebrar integridade
      await prisma.empresa.update({
        where: { id },
        data: { ativo: false },
      });
      return {
        message: `A empresa "${empresa.razaoSocial}" possui ferramentas vinculadas e foi inativada.`,
      };
    }

    await prisma.empresa.delete({
      where: { id },
    });

    return {
      message: `Empresa "${empresa.razaoSocial}" excluída com sucesso.`,
    };
  }
}
