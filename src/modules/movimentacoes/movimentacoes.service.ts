import qrcode from 'qrcode';
import { prisma } from '../../lib/prisma.js';
import { RegistrarEntradaInput, RegistrarBaixaInput, QueryMovimentacoesInput } from './movimentacoes.schemas.js';
import { registrarLog } from '../auditoria/auditoria.service.js';

export class MovimentacoesService {
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
  private async gerarQRCodeSvg(conteudo: string): Promise<string> {
    return qrcode.toString(conteudo, {
      type: 'svg',
      margin: 1,
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
    });
  }

  /**
   * RF06 - Entrada de Estoque Auditada
   * Exige ferramenta, ferramentaria, responsável (Pessoa) e ferramenteiro logado.
   * Gera novos exemplares físicos com tombos e QR Codes.
   */
  async registrarEntrada(
    data: RegistrarEntradaInput,
    idUsuarioLogado: number,
    clientInfo?: { ip?: string; dispositivo?: string }
  ) {
    // 1. Validar existência da ferramenta
    const ferramenta = await prisma.ferramenta.findUnique({
      where: { id: data.idFerramenta },
      include: { ferramentaria: true },
    });

    if (!ferramenta) {
      throw new Error('Ferramenta não encontrada no catálogo.');
    }

    // 2. Validar ferramentaria
    const ferramentaria = await prisma.ferramentaria.findUnique({
      where: { id: data.idFerramentaria },
    });

    if (!ferramentaria) {
      throw new Error('Ferramentaria informada não existe.');
    }

    // 3. Validar colaborador responsável pela entrega
    const colaborador = await prisma.pessoa.findUnique({
      where: { matricula: data.matriculaResponsavel.trim() },
    });

    if (!colaborador) {
      throw new Error(`Responsável com matrícula "${data.matriculaResponsavel}" não encontrado na base de colaboradores.`);
    }

    if (!colaborador.ativo) {
      throw new Error(`O colaborador ${colaborador.nome} (matrícula ${colaborador.matricula}) está marcado como INATIVO.`);
    }

    // 4. Identificar o próximo número de tombo para esta ferramenta
    const ultimoItem = await prisma.itemFerramenta.findFirst({
      where: { idFerramenta: data.idFerramenta },
      orderBy: { numeroTombo: 'desc' },
    });

    const proximoTombo = ultimoItem ? ultimoItem.numeroTombo + 1 : 1;
    const sigla = this.gerarSigla(ferramenta.descricao);

    // 5. Gerar os novos itens físicos individualizados
    const novosItensCriados = [];

    for (let i = 0; i < data.quantidade; i++) {
      const numeroTombo = proximoTombo + i;
      const tomboFormatado = String(numeroTombo).padStart(4, '0');
      const codigoIdentificador = `EMP${ferramenta.idEmpresa}-FRM${ferramentaria.id}-F${ferramenta.id}-${sigla}-${tomboFormatado}`;
      const qrcodeSvg = await this.gerarQRCodeSvg(codigoIdentificador);

      const novoItem = await prisma.itemFerramenta.create({
        data: {
          idFerramenta: ferramenta.id,
          numeroTombo,
          codigoIdentificador,
          qrcodeSvg,
          situacao: 'DISPONIVEL',
          ativo: true,
          observacao: data.motivo?.trim() || null,
        },
      });

      novosItensCriados.push(novoItem);
    }

    // 6. Criar o registro na tabela MovimentacaoEstoque
    const movimentacao = await prisma.movimentacaoEstoque.create({
      data: {
        tipo: 'ENTRADA',
        idFerramenta: ferramenta.id,
        idFerramentaria: ferramentaria.id,
        quantidade: data.quantidade,
        idUsuarioFerramenteiro: idUsuarioLogado,
        matriculaResponsavel: colaborador.matricula,
        motivo: data.motivo?.trim() || 'Entrada manual de estoque auditada',
      },
      include: {
        ferramenta: true,
        ferramentaria: true,
        ferramenteiro: {
          select: { id: true, nome: true, email: true },
        },
        responsavelEntrega: {
          select: { matricula: true, nome: true },
        },
      },
    });

    // 7. Registrar na Trilha de Auditoria (LogOperacao)
    await registrarLog({
      idUsuario: idUsuarioLogado,
      acao: 'ENTRADA_ESTOQUE',
      entidade: 'MovimentacaoEstoque',
      detalhes: {
        movimentacaoId: movimentacao.id,
        ferramenta: ferramenta.descricao,
        quantidade: data.quantidade,
        responsavelEntrega: `${colaborador.nome} (${colaborador.matricula})`,
        motivo: movimentacao.motivo,
        tombosGerados: novosItensCriados.map((item) => ({
          tombo: item.numeroTombo,
          codigo: item.codigoIdentificador,
        })),
      },
      ipOrigem: clientInfo?.ip,
      dispositivo: clientInfo?.dispositivo,
    });

    return {
      movimentacao,
      itensGerados: novosItensCriados,
    };
  }

  /**
   * RF07 - Baixa de Ferramentas Danificadas/Quebradas/Extraviadas
   * Exige seleção do exemplar específico e justificativa textual obrigatória.
   */
  async registrarBaixa(
    data: RegistrarBaixaInput,
    idUsuarioLogado: number,
    clientInfo?: { ip?: string; dispositivo?: string }
  ) {
    // 1. Buscar exemplar físico
    const item = await prisma.itemFerramenta.findFirst({
      where: {
        OR: [
          { id: data.idItemFerramenta },
          { codigoIdentificador: data.idItemFerramenta },
        ],
      },
      include: {
        ferramenta: {
          include: { ferramentaria: true },
        },
      },
    });

    if (!item) {
      throw new Error(`Exemplar físico não encontrado com o identificador informado: "${data.idItemFerramenta}".`);
    }

    // 2. Não permitir baixa se estiver em posse de colaborador (EMPRESTADO)
    if (item.situacao === 'EMPRESTADO') {
      throw new Error(
        `O item ${item.codigoIdentificador} está com status EMPRESTADO. É necessário registrar a devolução no módulo de Atendimento antes de dar baixa por avaria.`
      );
    }

    // 3. Definir nova situação e tipo de movimentação
    const tipoMovimentacao =
      data.tipo === 'AVARIADO'
        ? 'BAIXA_AVARIA'
        : data.tipo === 'EXTRAVIO'
        ? 'BAIXA_EXTRAVIO'
        : 'BAIXA_DESCARTE';

    const novaSituacao = data.tipo; // 'AVARIADO', 'BAIXADO', 'EXTRAVIO'
    const ativo = data.tipo === 'AVARIADO'; // Se avariado pode ainda existir para reparo; se baixado/extraviado fica inativo

    // 4. Atualizar o item físico
    const itemAtualizado = await prisma.itemFerramenta.update({
      where: { id: item.id },
      data: {
        situacao: novaSituacao,
        ativo,
        observacao: `[Baixa/Avaria]: ${data.motivo.trim()}`,
      },
    });

    // 5. Gravar registro em MovimentacaoEstoque
    const movimentacao = await prisma.movimentacaoEstoque.create({
      data: {
        tipo: tipoMovimentacao,
        idFerramenta: item.idFerramenta,
        idItemFerramenta: item.id,
        idFerramentaria: item.ferramenta.idFerramentaria,
        quantidade: 1,
        idUsuarioFerramenteiro: idUsuarioLogado,
        motivo: data.motivo.trim(),
      },
      include: {
        ferramenta: true,
        itemFerramenta: true,
        ferramentaria: true,
        ferramenteiro: {
          select: { id: true, nome: true, email: true },
        },
      },
    });

    // 6. Registrar na Trilha de Auditoria (LogOperacao)
    await registrarLog({
      idUsuario: idUsuarioLogado,
      acao: 'BAIXA_ITEM',
      entidade: 'ItemFerramenta',
      detalhes: {
        itemId: item.id,
        codigoIdentificador: item.codigoIdentificador,
        numeroTombo: item.numeroTombo,
        ferramenta: item.ferramenta.descricao,
        tipoBaixa: data.tipo,
        motivo: data.motivo.trim(),
      },
      ipOrigem: clientInfo?.ip,
      dispositivo: clientInfo?.dispositivo,
    });

    return {
      movimentacao,
      item: itemAtualizado,
    };
  }

  /**
   * Listagem histórica de movimentações de estoque com paginação e filtros
   */
  async list(filters: QueryMovimentacoesInput) {
    const page = Math.max(1, filters.page || 1);
    const limit = Math.min(100, Math.max(1, filters.limit || 20));
    const skip = (page - 1) * limit;

    const where: any = {};

    if (filters.tipo) {
      where.tipo = filters.tipo;
    }

    if (filters.idFerramentaria) {
      where.idFerramentaria = filters.idFerramentaria;
    }

    if (filters.idFerramenta) {
      where.idFerramenta = filters.idFerramenta;
    }

    if (filters.search) {
      const s = filters.search.trim();
      where.OR = [
        { motivo: { contains: s } },
        { ferramenta: { descricao: { contains: s } } },
        { itemFerramenta: { codigoIdentificador: { contains: s } } },
        { responsavelEntrega: { nome: { contains: s } } },
        { responsavelEntrega: { matricula: { contains: s } } },
      ];
    }

    const [total, movimentacoes] = await Promise.all([
      prisma.movimentacaoEstoque.count({ where }),
      prisma.movimentacaoEstoque.findMany({
        where,
        orderBy: { dataHora: 'desc' },
        skip,
        take: limit,
        include: {
          ferramenta: {
            select: {
              id: true,
              descricao: true,
            },
          },
          itemFerramenta: {
            select: {
              id: true,
              numeroTombo: true,
              codigoIdentificador: true,
              situacao: true,
            },
          },
          ferramentaria: {
            select: {
              id: true,
              descricao: true,
              localizacao: true,
            },
          },
          ferramenteiro: {
            select: {
              id: true,
              nome: true,
              email: true,
            },
          },
          responsavelEntrega: {
            select: {
              matricula: true,
              nome: true,
            },
          },
        },
      }),
    ]);

    return {
      movimentacoes,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getById(id: number) {
    const movimentacao = await prisma.movimentacaoEstoque.findUnique({
      where: { id },
      include: {
        ferramenta: true,
        itemFerramenta: true,
        ferramentaria: true,
        ferramenteiro: {
          select: { id: true, nome: true, email: true },
        },
        responsavelEntrega: {
          select: { matricula: true, nome: true },
        },
      },
    });

    if (!movimentacao) {
      throw new Error('Movimentação não encontrada.');
    }

    return movimentacao;
  }
}
