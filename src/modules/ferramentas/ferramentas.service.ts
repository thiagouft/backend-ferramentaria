import qrcode from 'qrcode';
import { prisma } from '../../lib/prisma.js';
import { CreateFerramentaInput, UpdateFerramentaInput } from './ferramentas.schemas.js';

export class FerramentasService {
  /**
   * Gera uma sigla mnemônica de 3 caracteres maiúsculos a partir da descrição
   */
  private gerarSigla(descricao: string): string {
    const limpo = descricao
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9\s]/g, '')
      .toUpperCase()
      .trim();

    const palavras = limpo.split(/\s+/).filter((p) => p.length > 0);
    if (palavras.length > 0 && palavras[0].length >= 3) {
      return palavras[0].substring(0, 3).toUpperCase();
    }
    return (limpo.replace(/\s+/g, '').substring(0, 3) || 'FER').padEnd(3, 'X').toUpperCase();
  }

  /**
   * Gera o SVG vetorial do QR Code com margem mínima para impressão nítida
   */
  async gerarQRCodeSvg(conteudo: string): Promise<string> {
    return qrcode.toString(conteudo, {
      type: 'svg',
      margin: 1,
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
    });
  }

  async list(filters: { idFerramentaria?: number; idEmpresa?: number; search?: string }) {
    const where: any = {};

    if (filters.idFerramentaria) {
      where.idFerramentaria = filters.idFerramentaria;
    }

    if (filters.idEmpresa) {
      where.idEmpresa = filters.idEmpresa;
    }

    if (filters.search) {
      const s = filters.search.trim();
      where.descricao = { contains: s };
    }

    const ferramentas = await prisma.ferramenta.findMany({
      where,
      orderBy: { id: 'desc' },
      include: {
        empresa: {
          select: {
            id: true,
            cnpj: true,
            razaoSocial: true,
          },
        },
        ferramentaria: {
          select: {
            id: true,
            descricao: true,
            localizacao: true,
          },
        },
        itens: {
          select: {
            situacao: true,
          },
        },
        _count: {
          select: {
            itens: true,
            movimentacoes: true,
          },
        },
      },
    });

    // Consultar IDs das ferramentas que possuem itens vinculados a empréstimos ou movimentações
    const ferramentasIds = ferramentas.map((f) => f.id);
    const itensComUso = await prisma.itemFerramenta.findMany({
      where: {
        idFerramenta: { in: ferramentasIds },
        OR: [
          { itensEmprestimo: { some: {} } },
          { movimentacoes: { some: {} } },
        ],
      },
      select: {
        idFerramenta: true,
      },
      distinct: ['idFerramenta'],
    });

    const idsComUso = new Set(itensComUso.map((i) => i.idFerramenta));

    return ferramentas.map((f) => {
      const total = f._count.itens;
      const totalMovimentacoes = f._count.movimentacoes;
      const disponiveis = f.itens.filter((i) => i.situacao === 'DISPONIVEL').length;
      const emprestados = f.itens.filter((i) => i.situacao === 'EMPRESTADO').length;
      const avariados = f.itens.filter((i) => i.situacao === 'AVARIADO' || i.situacao === 'BAIXADO').length;
      const manutencao = f.itens.filter((i) => i.situacao === 'MANUTENCAO').length;

      const temUso = totalMovimentacoes > 0 || idsComUso.has(f.id) || emprestados > 0 || avariados > 0 || manutencao > 0;
      const podeExcluir = !temUso;

      const { itens, ...rest } = f;
      return {
        ...rest,
        podeExcluir,
        resumoEstoque: {
          total,
          disponiveis,
          emprestados,
          avariados,
          manutencao,
        },
      };
    });
  }

  async getById(id: number) {
    const ferramenta = await prisma.ferramenta.findUnique({
      where: { id },
      include: {
        empresa: true,
        ferramentaria: true,
        itens: {
          orderBy: { numeroTombo: 'asc' },
        },
      },
    });

    if (!ferramenta) {
      throw new Error('Ferramenta não encontrada.');
    }

    return ferramenta;
  }

  async create(data: CreateFerramentaInput) {
    // 1. Validar existência da ferramentaria
    const ferramentaria = await prisma.ferramentaria.findUnique({
      where: { id: data.idFerramentaria },
    });

    if (!ferramentaria) {
      throw new Error('Ferramentaria informada não existe.');
    }

    // 2. Validar existência da empresa
    const empresa = await prisma.empresa.findUnique({
      where: { id: data.idEmpresa },
    });

    if (!empresa) {
      throw new Error('Empresa informada não existe.');
    }

    // 3. Criar registro no Catálogo de Ferramentas
    const ferramenta = await prisma.ferramenta.create({
      data: {
        descricao: data.descricao.trim(),
        valorUnitario: data.valorUnitario,
        idFerramentaria: data.idFerramentaria,
        idEmpresa: data.idEmpresa,
      },
    });

    // 4. Gerar exemplares físicos com tombos e QR Codes no novo padrão com empresa
    const sigla = this.gerarSigla(data.descricao);
    const quantidade = data.quantidadeInicial ?? 0;

    for (let i = 1; i <= quantidade; i++) {
      const numeroTombo = i;
      const tomboFormatado = String(numeroTombo).padStart(4, '0');
      // Padrão Único Oficial com Empresa: EMP{idEmpresa}-FRM{idFerramentaria}-F{idFerramenta}-{sigla}-{tombo}
      const codigoIdentificador = `EMP${empresa.id}-FRM${ferramentaria.id}-F${ferramenta.id}-${sigla}-${tomboFormatado}`;
      const qrcodeSvg = await this.gerarQRCodeSvg(codigoIdentificador);

      await prisma.itemFerramenta.create({
        data: {
          idFerramenta: ferramenta.id,
          numeroTombo,
          codigoIdentificador,
          qrcodeSvg,
          situacao: 'DISPONIVEL',
          ativo: true,
        },
      });
    }

    return this.getById(ferramenta.id);
  }

  async update(id: number, data: UpdateFerramentaInput) {
    await this.getById(id);

    if (data.idEmpresa) {
      const empresa = await prisma.empresa.findUnique({ where: { id: data.idEmpresa } });
      if (!empresa) throw new Error('Empresa informada não existe.');
    }

    if (data.idFerramentaria) {
      const ferramentaria = await prisma.ferramentaria.findUnique({ where: { id: data.idFerramentaria } });
      if (!ferramentaria) throw new Error('Ferramentaria informada não existe.');
    }

    return prisma.ferramenta.update({
      where: { id },
      data: {
        ...(data.descricao && { descricao: data.descricao.trim() }),
        ...(data.valorUnitario && { valorUnitario: data.valorUnitario }),
        ...(data.idEmpresa && { idEmpresa: data.idEmpresa }),
        ...(data.idFerramentaria && { idFerramentaria: data.idFerramentaria }),
      },
      include: {
        empresa: true,
        ferramentaria: true,
      },
    });
  }

  async addExemplares(idFerramenta: number, quantidade: number, observacao?: string | null) {
    const ferramenta = await this.getById(idFerramenta);

    // Identificar o último número de tombo cadastrado
    const ultimoItem = await prisma.itemFerramenta.findFirst({
      where: { idFerramenta },
      orderBy: { numeroTombo: 'desc' },
      select: { numeroTombo: true },
    });

    const inicioTombo = (ultimoItem?.numeroTombo || 0) + 1;
    const sigla = this.gerarSigla(ferramenta.descricao);
    const novosItens = [];

    for (let i = 0; i < quantidade; i++) {
      const numeroTombo = inicioTombo + i;
      const tomboFormatado = String(numeroTombo).padStart(4, '0');
      const codigoIdentificador = `EMP${ferramenta.idEmpresa}-FRM${ferramenta.idFerramentaria}-F${ferramenta.id}-${sigla}-${tomboFormatado}`;
      const qrcodeSvg = await this.gerarQRCodeSvg(codigoIdentificador);

      const novo = await prisma.itemFerramenta.create({
        data: {
          idFerramenta,
          numeroTombo,
          codigoIdentificador,
          qrcodeSvg,
          situacao: 'DISPONIVEL',
          observacao: observacao || null,
          ativo: true,
        },
      });
      novosItens.push(novo);
    }

    return {
      message: `${quantidade} novos exemplares criados com sucesso!`,
      itensCriados: novosItens,
    };
  }

  async delete(id: number) {
    const ferramenta = await prisma.ferramenta.findUnique({
      where: { id },
      include: {
        itens: {
          include: {
            itensEmprestimo: true,
            movimentacoes: true,
          },
        },
        movimentacoes: true,
      },
    });

    if (!ferramenta) {
      throw new Error('Ferramenta não encontrada.');
    }

    if (ferramenta.movimentacoes.length > 0) {
      throw new Error('Não é possível excluir esta ferramenta pois ela possui movimentações de estoque registradas no sistema.');
    }

    const temEmprestimos = ferramenta.itens.some((item) => item.itensEmprestimo.length > 0);
    if (temEmprestimos) {
      throw new Error('Não é possível excluir esta ferramenta pois existem empréstimos vinculados aos seus exemplares físicos.');
    }

    const temMovimentacaoItem = ferramenta.itens.some((item) => item.movimentacoes.length > 0);
    if (temMovimentacaoItem) {
      throw new Error('Não é possível excluir esta ferramenta pois existem registros de movimentação em seus exemplares.');
    }

    const temItemNaoDisponivel = ferramenta.itens.some((item) => item.situacao !== 'DISPONIVEL');
    if (temItemNaoDisponivel) {
      throw new Error('Não é possível excluir esta ferramenta pois há exemplares em situação de empréstimo, manutenção ou avaria.');
    }

    await prisma.$transaction(async (tx) => {
      await tx.itemFerramenta.deleteMany({
        where: { idFerramenta: id },
      });

      await tx.ferramenta.delete({
        where: { id },
      });
    });

    return {
      message: `Ferramenta "${ferramenta.descricao}" e seus exemplares foram excluídos com sucesso.`,
    };
  }
}
