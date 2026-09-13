import { prisma } from '../../lib/prisma.js';
import { CreateFerramentariaInput, UpdateFerramentariaInput } from './ferramentarias.schemas.js';

export class FerramentariasService {
  async listAll(includeInactive = false) {
    return prisma.ferramentaria.findMany({
      where: includeInactive ? undefined : { ativo: true },
      orderBy: { id: 'asc' },
      include: {
        _count: {
          select: {
            ferramentas: true,
            emprestimos: true,
          },
        },
      },
    });
  }

  async getById(id: number) {
    const ferramentaria = await prisma.ferramentaria.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            ferramentas: true,
            emprestimos: true,
          },
        },
      },
    });

    if (!ferramentaria) {
      throw new Error('Ferramentaria não encontrada.');
    }

    return ferramentaria;
  }

  async create(data: CreateFerramentariaInput) {
    return prisma.ferramentaria.create({
      data,
    });
  }

  async update(id: number, data: UpdateFerramentariaInput) {
    await this.getById(id);

    return prisma.ferramentaria.update({
      where: { id },
      data,
    });
  }

  async toggleStatus(id: number) {
    const existing = await this.getById(id);

    return prisma.ferramentaria.update({
      where: { id },
      data: {
        ativo: !existing.ativo,
      },
    });
  }

  async delete(id: number) {
    const existing = await this.getById(id);

    // Soft delete: inativação para manter integridade referencial com histórico
    return prisma.ferramentaria.update({
      where: { id: existing.id },
      data: { ativo: false },
    });
  }
}
