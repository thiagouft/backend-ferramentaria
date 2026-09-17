import { prisma } from '../../lib/prisma.js';

export interface RegistrarLogInput {
  idUsuario?: number | null;
  acao: string;
  entidade: string;
  detalhes: string | Record<string, any>;
  ipOrigem?: string | null;
  dispositivo?: string | null;
}

/**
 * Função utilitária centralizada para registrar eventos em LogOperacao
 */
export async function registrarLog(data: RegistrarLogInput) {
  try {
    const detalhesTexto =
      typeof data.detalhes === 'string'
        ? data.detalhes
        : JSON.stringify(data.detalhes);

    return await prisma.logOperacao.create({
      data: {
        idUsuario: data.idUsuario ?? null,
        acao: data.acao,
        entidade: data.entidade,
        detalhes: detalhesTexto,
        ipOrigem: data.ipOrigem ?? null,
        dispositivo: data.dispositivo ?? null,
      },
    });
  } catch (err) {
    console.error('Erro ao registrar log de auditoria:', err);
    return null;
  }
}

export class AuditoriaService {
  async listLogs(filters: {
    acao?: string;
    entidade?: string;
    idUsuario?: number;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, filters.page || 1);
    const limit = Math.min(100, Math.max(1, filters.limit || 20));
    const skip = (page - 1) * limit;

    const where: any = {};

    if (filters.acao) {
      where.acao = { contains: filters.acao };
    }

    if (filters.entidade) {
      where.entidade = { contains: filters.entidade };
    }

    if (filters.idUsuario) {
      where.idUsuario = filters.idUsuario;
    }

    if (filters.search) {
      const s = filters.search.trim();
      where.OR = [
        { acao: { contains: s } },
        { entidade: { contains: s } },
        { detalhes: { contains: s } },
      ];
    }

    const [total, logs] = await Promise.all([
      prisma.logOperacao.count({ where }),
      prisma.logOperacao.findMany({
        where,
        orderBy: { dataHora: 'desc' },
        skip,
        take: limit,
        include: {
          usuario: {
            select: {
              id: true,
              nome: true,
              email: true,
              perfil: true,
            },
          },
        },
      }),
    ]);

    return {
      logs,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
