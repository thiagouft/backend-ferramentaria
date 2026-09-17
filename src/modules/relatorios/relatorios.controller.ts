import { FastifyReply, FastifyRequest } from 'fastify';
import { RelatoriosService } from './relatorios.service.js';

const relatoriosService = new RelatoriosService();

export class RelatoriosController {
  /**
   * 1. Inventário Completo
   */
  async getInventario(request: FastifyRequest, reply: FastifyReply) {
    const query = request.query as {
      idFerramentaria?: string;
      formato?: 'json' | 'xlsx' | 'pdf';
    };

    const idFerr = query.idFerramentaria ? Number(query.idFerramentaria) : undefined;
    const formato = query.formato || 'json';

    try {
      const data = await relatoriosService.getInventario(idFerr);

      if (formato === 'xlsx') {
        const colunas = [
          { header: 'Ferramentaria', key: 'ferramentaria', width: 25 },
          { header: 'Código / Descrição', key: 'descricao', width: 35 },
          { header: 'Total Exemplares', key: 'totalExemplares', width: 15 },
          { header: 'Disponíveis', key: 'disponiveis', width: 15 },
          { header: 'Emprestados', key: 'emprestados', width: 15 },
          { header: 'Avariados', key: 'avariados', width: 15 },
          { header: 'Valor Unitário (R$)', key: 'valorUnitario', width: 18, isCurrency: true },
          { header: 'Valor Total (R$)', key: 'valorTotal', width: 18, isCurrency: true },
        ];

        const buffer = await relatoriosService.gerarExcel('Inventário Patrimonial de Ferramentas', colunas, data.itens);
        reply.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        reply.header('Content-Disposition', `attachment; filename="Inventario_${Date.now()}.xlsx"`);
        return reply.status(200).send(buffer);
      }

      if (formato === 'pdf') {
        const colunasPdf = [
          { header: 'Ferramentaria', key: 'ferramentaria', width: 140 },
          { header: 'Descrição', key: 'descricao', width: 220 },
          { header: 'Total', key: 'totalExemplares', width: 50 },
          { header: 'Disp', key: 'disponiveis', width: 50 },
          { header: 'Emp', key: 'emprestados', width: 50 },
          { header: 'Avar', key: 'avariados', width: 50 },
          { header: 'Unitário (R$)', key: 'valorUnitario', width: 85, isCurrency: true },
          { header: 'Total (R$)', key: 'valorTotal', width: 95, isCurrency: true },
        ];

        const resumo = `Total de Ferramentas: ${data.resumo.totalExemplares} | Disponíveis: ${data.resumo.totalDisponiveis} | Emprestadas: ${data.resumo.totalEmprestados} | Avariadas: ${data.resumo.totalAvariados} | Patrimônio Total: R$ ${data.resumo.valorPatrimonialTotal.toFixed(2)}`;
        const buffer = await relatoriosService.gerarPdf('Inventário Patrimonial de Ferramentas', colunasPdf, data.itens, resumo);
        reply.header('Content-Type', 'application/pdf');
        reply.header('Content-Disposition', `attachment; filename="Inventario_${Date.now()}.pdf"`);
        return reply.status(200).send(buffer);
      }

      return reply.status(200).send(data);
    } catch (err: any) {
      return reply.status(500).send({ message: err.message || 'Erro ao gerar relatório de inventário.' });
    }
  }

  /**
   * 2. Histórico de Empréstimos e Devoluções
   */
  async getHistoricoEmprestimos(request: FastifyRequest, reply: FastifyReply) {
    const query = request.query as {
      idFerramentaria?: string;
      dataInicio?: string;
      dataFim?: string;
      status?: string;
      matriculaColaborador?: string;
      formato?: 'json' | 'xlsx' | 'pdf';
    };

    const idFerr = query.idFerramentaria ? Number(query.idFerramentaria) : undefined;
    const formato = query.formato || 'json';

    try {
      const data = await relatoriosService.getHistoricoEmprestimos({
        idFerramentaria: idFerr,
        dataInicio: query.dataInicio,
        dataFim: query.dataFim,
        status: query.status,
        matriculaColaborador: query.matriculaColaborador,
      });

      if (formato === 'xlsx') {
        const colunas = [
          { header: 'Nº Protocolo', key: 'id', width: 22 },
          { header: 'Ferramentaria', key: 'ferramentaria', width: 22 },
          { header: 'Matrícula', key: 'matriculaColaborador', width: 16 },
          { header: 'Colaborador', key: 'nomeColaborador', width: 28 },
          { header: 'Data Retirada', key: 'dataRetirada', width: 18 },
          { header: 'Status', key: 'status', width: 18 },
          { header: 'Total Itens', key: 'totalItens', width: 12 },
          { header: 'Devolvidos', key: 'devolvidos', width: 12 },
          { header: 'Pendentes', key: 'pendentes', width: 12 },
          { header: 'Valor Retido (R$)', key: 'valorTotalCautela', width: 18, isCurrency: true },
          { header: 'Ferramentas', key: 'itensNomes', width: 45 },
        ];

        const buffer = await relatoriosService.gerarExcel('Histórico de Empréstimos e Devoluções', colunas, data.itens);
        reply.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        reply.header('Content-Disposition', `attachment; filename="Emprestimos_${Date.now()}.xlsx"`);
        return reply.status(200).send(buffer);
      }

      if (formato === 'pdf') {
        const colunasPdf = [
          { header: 'Protocolo', key: 'id', width: 90 },
          { header: 'Ferramentaria', key: 'ferramentaria', width: 120 },
          { header: 'Matrícula', key: 'matriculaColaborador', width: 90 },
          { header: 'Colaborador', key: 'nomeColaborador', width: 160 },
          { header: 'Status', key: 'status', width: 100 },
          { header: 'Itens', key: 'totalItens', width: 50 },
          { header: 'Devolv', key: 'devolvidos', width: 50 },
          { header: 'Valor Empréstimo', key: 'valorTotalCautela', width: 122, isCurrency: true },
        ];

        const buffer = await relatoriosService.gerarPdf('Histórico de Empréstimos e Devoluções', colunasPdf, data.itens);
        reply.header('Content-Type', 'application/pdf');
        reply.header('Content-Disposition', `attachment; filename="Emprestimos_${Date.now()}.pdf"`);
        return reply.status(200).send(buffer);
      }

      return reply.status(200).send(data);
    } catch (err: any) {
      return reply.status(500).send({ message: err.message || 'Erro ao gerar relatório de empréstimos.' });
    }
  }

  /**
   * 3. Itens com Atraso de Devolução (Overdue)
   */
  async getItensComAtraso(request: FastifyRequest, reply: FastifyReply) {
    const query = request.query as {
      idFerramentaria?: string;
      formato?: 'json' | 'xlsx' | 'pdf';
    };

    const idFerr = query.idFerramentaria ? Number(query.idFerramentaria) : undefined;
    const formato = query.formato || 'json';

    try {
      const data = await relatoriosService.getItensComAtraso(idFerr);

      if (formato === 'xlsx') {
        const colunas = [
          { header: 'Código Identificador', key: 'codigoIdentificador', width: 22 },
          { header: 'Descrição Ferramenta', key: 'ferramenta', width: 30 },
          { header: 'Ferramentaria', key: 'ferramentaria', width: 22 },
          { header: 'Matrícula', key: 'matriculaColaborador', width: 16 },
          { header: 'Colaborador', key: 'nomeColaborador', width: 28 },
          { header: 'Data Prevista', key: 'dataPrevista', width: 16 },
          { header: 'Dias em Atraso', key: 'diasAtraso', width: 16 },
          { header: 'Valor Unitário (R$)', key: 'valorUnitario', width: 18, isCurrency: true },
        ];

        const buffer = await relatoriosService.gerarExcel('Relatório de Ferramentas em Atraso', colunas, data.itens);
        reply.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        reply.header('Content-Disposition', `attachment; filename="Atrasos_${Date.now()}.xlsx"`);
        return reply.status(200).send(buffer);
      }

      if (formato === 'pdf') {
        const colunasPdf = [
          { header: 'Código', key: 'codigoIdentificador', width: 100 },
          { header: 'Ferramenta', key: 'ferramenta', width: 160 },
          { header: 'Ferramentaria', key: 'ferramentaria', width: 120 },
          { header: 'Matrícula', key: 'matriculaColaborador', width: 90 },
          { header: 'Colaborador', key: 'nomeColaborador', width: 160 },
          { header: 'Atraso (Dias)', key: 'diasAtraso', width: 72 },
          { header: 'Valor (R$)', key: 'valorUnitario', width: 80, isCurrency: true },
        ];

        const resumo = `Total de Ferramentas Retidas com Atraso: ${data.totalItensAtrasados} | Valor Patrimonial em Atraso: R$ ${data.valorTotalRetido.toFixed(2)}`;
        const buffer = await relatoriosService.gerarPdf('Relatório de Ferramentas em Atraso', colunasPdf, data.itens, resumo);
        reply.header('Content-Type', 'application/pdf');
        reply.header('Content-Disposition', `attachment; filename="Atrasos_${Date.now()}.pdf"`);
        return reply.status(200).send(buffer);
      }

      return reply.status(200).send(data);
    } catch (err: any) {
      return reply.status(500).send({ message: err.message || 'Erro ao consultar atrasos.' });
    }
  }

  /**
   * 4. Perdas e Avarias
   */
  async getPerdasAvarias(request: FastifyRequest, reply: FastifyReply) {
    const query = request.query as {
      idFerramentaria?: string;
      dataInicio?: string;
      dataFim?: string;
      formato?: 'json' | 'xlsx' | 'pdf';
    };

    const idFerr = query.idFerramentaria ? Number(query.idFerramentaria) : undefined;
    const formato = query.formato || 'json';

    try {
      const data = await relatoriosService.getPerdasAvarias({
        idFerramentaria: idFerr,
        dataInicio: query.dataInicio,
        dataFim: query.dataFim,
      });

      if (formato === 'xlsx') {
        const colunas = [
          { header: 'Tipo Movimentação', key: 'tipo', width: 18 },
          { header: 'Código Identificador', key: 'codigoIdentificador', width: 22 },
          { header: 'Ferramenta', key: 'ferramenta', width: 30 },
          { header: 'Ferramentaria', key: 'ferramentaria', width: 22 },
          { header: 'Data/Hora', key: 'dataHora', width: 18 },
          { header: 'Prejuízo (R$)', key: 'valorPrejuizo', width: 18, isCurrency: true },
          { header: 'Motivo / Laudo da Quebra', key: 'motivoLaudo', width: 45 },
          { header: 'Responsável', key: 'responsavel', width: 25 },
          { header: 'Ferramenteiro', key: 'ferramenteiro', width: 25 },
        ];

        const buffer = await relatoriosService.gerarExcel('Relatório de Perdas e Avarias', colunas, data.itens);
        reply.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        reply.header('Content-Disposition', `attachment; filename="Avarias_${Date.now()}.xlsx"`);
        return reply.status(200).send(buffer);
      }

      if (formato === 'pdf') {
        const colunasPdf = [
          { header: 'Tipo', key: 'tipo', width: 80 },
          { header: 'Código', key: 'codigoIdentificador', width: 90 },
          { header: 'Ferramenta', key: 'ferramenta', width: 150 },
          { header: 'Ferramentaria', key: 'ferramentaria', width: 110 },
          { header: 'Prejuízo (R$)', key: 'valorPrejuizo', width: 90, isCurrency: true },
          { header: 'Motivo / Causa', key: 'motivoLaudo', width: 160 },
          { header: 'Operador', key: 'responsavel', width: 102 },
        ];

        const resumo = `Total de Avarias / Baixas: ${data.totalOcorrencias} | Prejuízo Patrimonial Acumulado: R$ ${data.totalPrejuizo.toFixed(2)}`;
        const buffer = await relatoriosService.gerarPdf('Relatório de Perdas e Avarias', colunasPdf, data.itens, resumo);
        reply.header('Content-Type', 'application/pdf');
        reply.header('Content-Disposition', `attachment; filename="Avarias_${Date.now()}.pdf"`);
        return reply.status(200).send(buffer);
      }

      return reply.status(200).send(data);
    } catch (err: any) {
      return reply.status(500).send({ message: err.message || 'Erro ao gerar relatório de avarias.' });
    }
  }
}
