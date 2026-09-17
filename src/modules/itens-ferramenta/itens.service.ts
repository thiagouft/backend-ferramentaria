import { prisma } from '../../lib/prisma.js';

export class ItensFerramentaService {
  async list(filters: {
    idFerramentaria?: number;
    idFerramenta?: number;
    idEmpresa?: number;
    situacao?: string;
    search?: string;
  }) {
    const where: any = { ativo: true };

    if (filters.idFerramenta) {
      where.idFerramenta = filters.idFerramenta;
    }

    if (filters.idFerramentaria) {
      where.ferramenta = {
        ...(where.ferramenta || {}),
        idFerramentaria: filters.idFerramentaria,
      };
    }

    if (filters.idEmpresa) {
      where.ferramenta = {
        ...(where.ferramenta || {}),
        idEmpresa: filters.idEmpresa,
      };
    }

    if (filters.situacao) {
      where.situacao = filters.situacao;
    }

    if (filters.search) {
      const s = filters.search.trim();
      where.OR = [
        { codigoIdentificador: { contains: s } },
        { ferramenta: { descricao: { contains: s } } },
        { ferramenta: { empresa: { razaoSocial: { contains: s } } } },
      ];
    }

    return prisma.itemFerramenta.findMany({
      where,
      orderBy: [
        { idFerramenta: 'asc' },
        { numeroTombo: 'asc' },
      ],
      include: {
        ferramenta: {
          include: {
            empresa: true,
            ferramentaria: true,
          },
        },
      },
    });
  }

  async getByCodigo(codigoIdentificador: string) {
    const clean = codigoIdentificador.trim().toUpperCase();

    // 1. Busca exata por código identificador
    let item = await prisma.itemFerramenta.findUnique({
      where: { codigoIdentificador: clean },
      include: {
        ferramenta: {
          include: {
            empresa: true,
            ferramentaria: true,
          },
        },
      },
    });

    if (item) return item;

    // 2. Busca por ID UUID
    if (clean.length === 36 && clean.includes('-')) {
      item = await prisma.itemFerramenta.findUnique({
        where: { id: clean.toLowerCase() },
        include: {
          ferramenta: {
            include: {
              empresa: true,
              ferramentaria: true,
            },
          },
        },
      });
      if (item) return item;
    }

    // 3. Busca flexível por substring ou código sem prefixos
    item = await prisma.itemFerramenta.findFirst({
      where: {
        OR: [
          { codigoIdentificador: { contains: clean } },
          { codigoIdentificador: { contains: clean.replace(/\s+/g, '') } },
        ],
      },
      include: {
        ferramenta: {
          include: {
            empresa: true,
            ferramentaria: true,
          },
        },
      },
    });

    if (!item) {
      throw new Error(`Item com código '${codigoIdentificador}' não foi encontrado.`);
    }

    return item;
  }
}
