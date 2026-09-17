import { prisma } from '../../lib/prisma.js';
import {
  CriarRetiradaInput,
  RegistrarDevolucaoInput,
  QueryEmprestimosInput,
} from './emprestimos.schemas.js';
import { registrarLog } from '../auditoria/auditoria.service.js';

export class EmprestimosService {
  /**
   * RF09 - Fluxo de Retirada (Empréstimo em Lote)
   * Valida colaborador, ferramentaria e cada item antes de criar a retirada.
   */
  async criarRetirada(
    data: CriarRetiradaInput,
    idUsuarioLogado: number,
    clientInfo?: { ip?: string; dispositivo?: string }
  ) {
    // 1. Validar colaborador
    const colaborador = await prisma.pessoa.findUnique({
      where: { matricula: data.matriculaColaborador.trim() },
    });

    if (!colaborador) {
      throw new Error(`Colaborador com matrícula "${data.matriculaColaborador}" não encontrado.`);
    }

    if (!colaborador.ativo) {
      throw new Error(`O colaborador ${colaborador.nome} está marcado como INATIVO.`);
    }

    if (colaborador.situacao !== 1) {
      throw new Error(`O colaborador ${colaborador.nome} está com situação de acesso BLOQUEADA.`);
    }

    // 2. Validar ferramentaria ativa
    const ferramentaria = await prisma.ferramentaria.findUnique({
      where: { id: data.idFerramentaria },
    });

    if (!ferramentaria || !ferramentaria.ativo) {
      throw new Error('Ferramentaria informada não existe ou está desativada.');
    }

    // 3. Validar itens individualmente
    const codigosUnicos = Array.from(new Set(data.itensCodigos.map((c) => c.trim().toUpperCase())));
    const itensValidados: any[] = [];

    for (const codigo of codigosUnicos) {
      const item = await prisma.itemFerramenta.findFirst({
        where: { codigoIdentificador: codigo },
        include: {
          ferramenta: {
            include: {
              ferramentaria: true,
            },
          },
        },
      });

      if (!item) {
        throw new Error(`Ferramenta com código identificador "${codigo}" não foi localizada.`);
      }

      // RF02 / RF09: Validação de pertença à ferramentaria
      if (item.ferramenta.idFerramentaria !== data.idFerramentaria) {
        const nomeFerramentariaOrigem =
          item.ferramenta.ferramentaria?.descricao || `Ferramentaria #${item.ferramenta.idFerramentaria}`;
        throw new Error(
          `A ferramenta ${codigo} (${item.ferramenta.descricao}) pertence à ${nomeFerramentariaOrigem}. Retiradas só podem ser realizadas na ferramentaria de origem.`
        );
      }

      // Validação de disponibilidade
      if (item.situacao !== 'DISPONIVEL') {
        throw new Error(
          `A ferramenta ${codigo} (${item.ferramenta.descricao}) não está disponível para retirada. Situação atual: "${item.situacao}".`
        );
      }

      itensValidados.push(item);
    }

    // 4. Executar criação do empréstimo em transação atômica
    const emprestimoCriado = await prisma.$transaction(async (tx) => {
      // Cria registro de Emprestimo
      const emp = await tx.emprestimo.create({
        data: {
          idFerramentaria: data.idFerramentaria,
          matriculaColaborador: colaborador.matricula,
          idUsuarioFerramenteiro: idUsuarioLogado,
          status: 'ABERTO',
          dataPrevisaoDevolucao: data.dataPrevisaoDevolucao ? new Date(data.dataPrevisaoDevolucao) : null,
          observacoes: data.observacoes?.trim() || null,
        },
      });

      // Cria ItemEmprestimo e atualiza situação de cada ItemFerramenta
      for (const item of itensValidados) {
        await tx.itemEmprestimo.create({
          data: {
            idEmprestimo: emp.id,
            idItemFerramenta: item.id,
            condicaoDevolucao: 'NORMAL',
          },
        });

        await tx.itemFerramenta.update({
          where: { id: item.id },
          data: {
            situacao: 'EMPRESTADO',
          },
        });
      }

      return emp;
    });

    // 5. Registrar log de auditoria
    await registrarLog({
      idUsuario: idUsuarioLogado,
      acao: 'RETIRADA_EMPRESTIMO',
      entidade: 'Emprestimo',
      detalhes: {
        emprestimoId: emprestimoCriado.id,
        colaborador: `${colaborador.nome} (${colaborador.matricula})`,
        ferramentaria: ferramentaria.descricao,
        quantidadeItens: itensValidados.length,
        itens: itensValidados.map((i) => ({
          codigo: i.codigoIdentificador,
          tombo: i.numeroTombo,
          ferramenta: i.ferramenta.descricao,
        })),
      },
      ipOrigem: clientInfo?.ip,
      dispositivo: clientInfo?.dispositivo,
    });

    return this.getById(emprestimoCriado.id);
  }

  /**
   * RF10 - Fluxo de Devolução com Validação Rigorosa de Titularidade
   * Confere titularidade, ferramentaria de origem e aponta avaria.
   */
  async registrarDevolucao(
    data: RegistrarDevolucaoInput,
    idUsuarioLogado: number,
    clientInfo?: { ip?: string; dispositivo?: string }
  ) {
    // 1. Validar colaborador que está devolvendo
    const colaborador = await prisma.pessoa.findUnique({
      where: { matricula: data.matriculaColaborador.trim() },
    });

    if (!colaborador) {
      throw new Error(`Colaborador com matrícula "${data.matriculaColaborador}" não encontrado.`);
    }

    // 2. Validar cada ferramenta que está sendo devolvida
    const itensParaDevolver: any[] = [];

    for (const itemInput of data.itens) {
      const codigoLimpo = itemInput.codigoIdentificador.trim().toUpperCase();

      const itemDb = await prisma.itemFerramenta.findFirst({
        where: { codigoIdentificador: codigoLimpo },
        include: {
          ferramenta: {
            include: { ferramentaria: true },
          },
        },
      });

      if (!itemDb) {
        throw new Error(`Ferramenta com código identificador "${codigoLimpo}" não encontrada.`);
      }

      // Buscar o registro de empréstimo ativo/em aberto deste item
      const itemEmprestimoAberto = await prisma.itemEmprestimo.findFirst({
        where: {
          idItemFerramenta: itemDb.id,
          dataHoraDevolucao: null,
        },
        include: {
          emprestimo: {
            include: {
              colaborador: true,
              ferramentaria: true,
            },
          },
        },
      });

      if (!itemEmprestimoAberto) {
        throw new Error(
          `A ferramenta ${codigoLimpo} (${itemDb.ferramenta.descricao}) não consta como emprestada ou já foi devolvida.`
        );
      }

      // RF10 - Validação Rigorosa de Titularidade
      if (itemEmprestimoAberto.emprestimo.matriculaColaborador !== colaborador.matricula) {
        const titularReal = itemEmprestimoAberto.emprestimo.colaborador;
        const dataRetiradaFormatada = itemEmprestimoAberto.emprestimo.dataHoraRetirada.toLocaleString('pt-BR');
        throw new Error(
          `Atenção: A ferramenta ${codigoLimpo} (${itemDb.ferramenta.descricao}) não foi retirada por ${colaborador.nome}. Consta sob posse de ${titularReal.nome} (Matrícula ${titularReal.matricula}) desde ${dataRetiradaFormatada}.`
        );
      }

      // RF02 - Validação de Ferramentaria de Origem
      if (itemEmprestimoAberto.emprestimo.idFerramentaria !== data.idFerramentaria) {
        throw new Error(
          `A ferramenta ${codigoLimpo} pertence à ${itemEmprestimoAberto.emprestimo.ferramentaria.descricao}. Devolução não permitida na ferramentaria atual.`
        );
      }

      // Validar justificativa obrigatória se houver avaria
      if (itemInput.condicaoDevolucao === 'AVARIADO') {
        if (!itemInput.observacaoDevolucao || itemInput.observacaoDevolucao.trim().length < 3) {
          throw new Error(
            `Para devolução com avaria na ferramenta ${codigoLimpo}, é obrigatório informar a descrição do dano.`
          );
        }
      }

      itensParaDevolver.push({
        itemDb,
        itemEmprestimoAberto,
        condicaoDevolucao: itemInput.condicaoDevolucao,
        observacaoDevolucao: itemInput.observacaoDevolucao?.trim() || null,
      });
    }

    // 3. Processar devolução em transação atômica
    const resultado = await prisma.$transaction(async (tx) => {
      const emprestimosAfetadosIds = new Set<string>();

      for (const dev of itensParaDevolver) {
        emprestimosAfetadosIds.add(dev.itemEmprestimoAberto.idEmprestimo);

        // Atualizar ItemEmprestimo com data, operador e condição
        await tx.itemEmprestimo.update({
          where: { id: dev.itemEmprestimoAberto.id },
          data: {
            dataHoraDevolucao: new Date(),
            idUsuarioDevolucao: idUsuarioLogado,
            condicaoDevolucao: dev.condicaoDevolucao,
            observacaoDevolucao: dev.observacaoDevolucao,
          },
        });

        // Atualizar situação física do item
        if (dev.condicaoDevolucao === 'NORMAL') {
          await tx.itemFerramenta.update({
            where: { id: dev.itemDb.id },
            data: {
              situacao: 'DISPONIVEL',
              observacao: `[Devolvido em perfeito estado]: ${new Date().toLocaleDateString('pt-BR')}`,
            },
          });
        } else {
          // AVARIADO
          await tx.itemFerramenta.update({
            where: { id: dev.itemDb.id },
            data: {
              situacao: 'AVARIADO',
              observacao: `[Avaria apontada na devolução]: ${dev.observacaoDevolucao}`,
            },
          });

          // Registrar em MovimentacaoEstoque a baixa por avaria
          await tx.movimentacaoEstoque.create({
            data: {
              tipo: 'BAIXA_AVARIA',
              idFerramenta: dev.itemDb.idFerramenta,
              idItemFerramenta: dev.itemDb.id,
              idFerramentaria: data.idFerramentaria,
              quantidade: 1,
              idUsuarioFerramenteiro: idUsuarioLogado,
              matriculaResponsavel: colaborador.matricula,
              motivo: `[Avaria na devolução por ${colaborador.nome}]: ${dev.observacaoDevolucao}`,
            },
          });
        }
      }

      // 4. Avaliar status de cada Emprestimo afetado
      const emprestimosAtualizados = [];
      for (const empId of emprestimosAfetadosIds) {
        const itensRestantes = await tx.itemEmprestimo.count({
          where: {
            idEmprestimo: empId,
            dataHoraDevolucao: null,
          },
        });

        const novoStatus = itensRestantes === 0 ? 'FINALIZADO' : 'FINALIZADO_PARCIAL';

        const empAtualizado = await tx.emprestimo.update({
          where: { id: empId },
          data: { status: novoStatus },
        });

        emprestimosAtualizados.push(empAtualizado);
      }

      return {
        itensDevolvidos: itensParaDevolver.length,
        emprestimosAtualizados,
      };
    });

    // 5. Registrar log de auditoria
    await registrarLog({
      idUsuario: idUsuarioLogado,
      acao: 'DEVOLUCAO_EMPRESTIMO',
      entidade: 'Emprestimo',
      detalhes: {
        colaborador: `${colaborador.nome} (${colaborador.matricula})`,
        quantidadeDevolvida: itensParaDevolver.length,
        itens: itensParaDevolver.map((i) => ({
          codigo: i.itemDb.codigoIdentificador,
          condicao: i.condicaoDevolucao,
          avaria: i.observacaoDevolucao,
        })),
        statusEmprestimos: resultado.emprestimosAtualizados.map((e) => ({
          id: e.id,
          status: e.status,
        })),
      },
      ipOrigem: clientInfo?.ip,
      dispositivo: clientInfo?.dispositivo,
    });

    return resultado;
  }

  /**
   * Consulta todas as ferramentas atualmente em posse/custódia de um colaborador
   */
  async consultarCustodia(matricula: string) {
    const colaborador = await prisma.pessoa.findUnique({
      where: { matricula: matricula.trim() },
    });

    if (!colaborador) {
      throw new Error(`Colaborador com matrícula "${matricula}" não encontrado.`);
    }

    const itensEmCustodia = await prisma.itemEmprestimo.findMany({
      where: {
        emprestimo: {
          matriculaColaborador: colaborador.matricula,
        },
        dataHoraDevolucao: null,
      },
      orderBy: {
        emprestimo: {
          dataHoraRetirada: 'desc',
        },
      },
      include: {
        emprestimo: {
          include: {
            ferramentaria: true,
            ferramenteiro: {
              select: { id: true, nome: true, email: true },
            },
          },
        },
        itemFerramenta: {
          include: {
            ferramenta: true,
          },
        },
      },
    });

    return {
      colaborador: {
        matricula: colaborador.matricula,
        nome: colaborador.nome,
        situacao: colaborador.situacao,
        ativo: colaborador.ativo,
      },
      totalItensEmPosse: itensEmCustodia.length,
      itens: itensEmCustodia.map((item) => ({
        idItemEmprestimo: item.id,
        idEmprestimo: item.idEmprestimo,
        dataHoraRetirada: item.emprestimo.dataHoraRetirada,
        ferramentariaOrigem: item.emprestimo.ferramentaria.descricao,
        idFerramentaria: item.emprestimo.idFerramentaria,
        ferramenteiroEntrega: item.emprestimo.ferramenteiro.nome,
        codigoIdentificador: item.itemFerramenta.codigoIdentificador,
        numeroTombo: item.itemFerramenta.numeroTombo,
        descricao: item.itemFerramenta.ferramenta.descricao,
        valorUnitario: item.itemFerramenta.ferramenta.valorUnitario,
      })),
    };
  }

  /**
   * Listagem histórica de empréstimos com paginação e filtros
   */
  async list(filters: QueryEmprestimosInput) {
    const page = Math.max(1, filters.page || 1);
    const limit = Math.min(100, Math.max(1, filters.limit || 20));
    const skip = (page - 1) * limit;

    const where: any = {};

    if (filters.idFerramentaria) {
      where.idFerramentaria = filters.idFerramentaria;
    }

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.matriculaColaborador) {
      where.matriculaColaborador = filters.matriculaColaborador;
    }

    if (filters.search) {
      const s = filters.search.trim();
      where.OR = [
        { matriculaColaborador: { contains: s } },
        { colaborador: { nome: { contains: s } } },
        { observacoes: { contains: s } },
        {
          itens: {
            some: {
              itemFerramenta: {
                codigoIdentificador: { contains: s },
              },
            },
          },
        },
      ];
    }

    const [total, emprestimos] = await Promise.all([
      prisma.emprestimo.count({ where }),
      prisma.emprestimo.findMany({
        where,
        orderBy: { dataHoraRetirada: 'desc' },
        skip,
        take: limit,
        include: {
          colaborador: {
            select: { matricula: true, nome: true, situacao: true, ativo: true },
          },
          ferramentaria: {
            select: { id: true, descricao: true, localizacao: true },
          },
          ferramenteiro: {
            select: { id: true, nome: true, email: true },
          },
          itens: {
            include: {
              itemFerramenta: {
                include: {
                  ferramenta: {
                    select: { id: true, descricao: true },
                  },
                },
              },
              usuarioDevolucao: {
                select: { id: true, nome: true },
              },
            },
          },
        },
      }),
    ]);

    return {
      emprestimos,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getById(id: string) {
    const emprestimo = await prisma.emprestimo.findUnique({
      where: { id },
      include: {
        colaborador: true,
        ferramentaria: true,
        ferramenteiro: {
          select: { id: true, nome: true, email: true },
        },
        itens: {
          include: {
            itemFerramenta: {
              include: {
                ferramenta: true,
              },
            },
            usuarioDevolucao: {
              select: { id: true, nome: true },
            },
          },
        },
      },
    });

    if (!emprestimo) {
      throw new Error(`Empréstimo com ID "${id}" não encontrado.`);
    }

    return emprestimo;
  }
}
