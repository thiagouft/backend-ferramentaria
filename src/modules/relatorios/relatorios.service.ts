import { prisma } from '../../lib/prisma.js';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';

export class RelatoriosService {
  /**
   * 1. Relatório de Inventário Completo por Ferramentaria e Valor Contábil
   */
  async getInventario(idFerramentaria?: number) {
    const whereFerr: any = {};
    if (idFerramentaria) {
      whereFerr.id = idFerramentaria;
    }

    const ferramentarias = await prisma.ferramentaria.findMany({
      where: whereFerr,
      include: {
        ferramentas: {
          include: {
            itens: true,
          },
          orderBy: { descricao: 'asc' },
        },
      },
    });

    const itensRelatorio: any[] = [];
    let valorTotalGeral = 0;
    let totalItensGeral = 0;
    let totalDisponiveisGeral = 0;
    let totalEmprestadosGeral = 0;
    let totalAvariadosGeral = 0;

    for (const ferr of ferramentarias) {
      for (const f of ferr.ferramentas) {
        const total = f.itens.length;
        const disponiveis = f.itens.filter((i) => i.situacao === 'DISPONIVEL').length;
        const emprestados = f.itens.filter((i) => i.situacao === 'EMPRESTADO').length;
        const avariados = f.itens.filter((i) => i.situacao === 'AVARIADO').length;
        const valorUnit = Number(f.valorUnitario || 0);
        const valorTotal = total * valorUnit;

        valorTotalGeral += valorTotal;
        totalItensGeral += total;
        totalDisponiveisGeral += disponiveis;
        totalEmprestadosGeral += emprestados;
        totalAvariadosGeral += avariados;

        itensRelatorio.push({
          ferramentariaId: ferr.id,
          ferramentaria: ferr.descricao,
          ferramentaId: f.id,
          descricao: f.descricao,
          valorUnitario: valorUnit,
          totalExemplares: total,
          disponiveis,
          emprestados,
          avariados,
          valorTotal,
        });
      }
    }

    return {
      resumo: {
        totalFerramentarias: ferramentarias.length,
        totalExemplares: totalItensGeral,
        totalDisponiveis: totalDisponiveisGeral,
        totalEmprestados: totalEmprestadosGeral,
        totalAvariados: totalAvariadosGeral,
        valorPatrimonialTotal: valorTotalGeral,
      },
      itens: itensRelatorio,
    };
  }

  /**
   * 2. Relatório de Histórico de Retiradas e Devoluções (Empréstimos)
   */
  async getHistoricoEmprestimos(filtros: {
    idFerramentaria?: number;
    dataInicio?: string;
    dataFim?: string;
    status?: string;
    matriculaColaborador?: string;
  }) {
    const where: any = {};

    if (filtros.idFerramentaria) {
      where.idFerramentaria = filtros.idFerramentaria;
    }

    if (filtros.status && filtros.status !== 'TODOS') {
      where.status = filtros.status;
    }

    if (filtros.matriculaColaborador) {
      where.matriculaColaborador = { contains: filtros.matriculaColaborador };
    }

    if (filtros.dataInicio || filtros.dataFim) {
      where.dataHoraRetirada = {};
      if (filtros.dataInicio) {
        where.dataHoraRetirada.gte = new Date(`${filtros.dataInicio}T00:00:00.000Z`);
      }
      if (filtros.dataFim) {
        where.dataHoraRetirada.lte = new Date(`${filtros.dataFim}T23:59:59.999Z`);
      }
    }

    const emprestimos = await prisma.emprestimo.findMany({
      where,
      orderBy: { dataHoraRetirada: 'desc' },
      include: {
        colaborador: { select: { matricula: true, nome: true } },
        ferramentaria: { select: { id: true, descricao: true } },
        ferramenteiro: { select: { id: true, nome: true } },
        itens: {
          include: {
            itemFerramenta: {
              include: {
                ferramenta: { select: { descricao: true, valorUnitario: true } },
              },
            },
          },
        },
      },
    });

    const itensMapeados = emprestimos.map((emp) => {
      const totalItens = emp.itens.length;
      const devolvidos = emp.itens.filter((i) => i.dataHoraDevolucao !== null).length;
      const valorTotalCautela = emp.itens.reduce(
        (acc, curr) => acc + Number(curr.itemFerramenta.ferramenta.valorUnitario || 0),
        0
      );

      const nomesItens = emp.itens
        .map((i) => `${i.itemFerramenta.codigoIdentificador} - ${i.itemFerramenta.ferramenta.descricao}`)
        .join('; ');

      return {
        id: emp.id,
        ferramentaria: emp.ferramentaria.descricao,
        matriculaColaborador: emp.matriculaColaborador,
        nomeColaborador: emp.colaborador.nome,
        ferramenteiro: emp.ferramenteiro.nome,
        dataRetirada: emp.dataHoraRetirada,
        dataPrevisaoDevolucao: emp.dataPrevisaoDevolucao,
        status: emp.status,
        totalItens,
        devolvidos,
        pendentes: totalItens - devolvidos,
        valorTotalCautela,
        itensNomes: nomesItens,
      };
    });

    return {
      resumo: {
        totalEmprestimos: emprestimos.length,
        totalItensMovimentados: itensMapeados.reduce((acc, curr) => acc + curr.totalItens, 0),
        valorTotalMovimentado: itensMapeados.reduce((acc, curr) => acc + curr.valorTotalCautela, 0),
      },
      itens: itensMapeados,
    };
  }

  /**
   * 3. Itens com Atraso de Devolução (Overdue)
   */
  async getItensComAtraso(idFerramentaria?: number) {
    const agora = new Date();

    const where: any = {
      dataHoraDevolucao: null,
      emprestimo: {
        dataPrevisaoDevolucao: {
          lt: agora,
        },
      },
    };

    if (idFerramentaria) {
      where.emprestimo.idFerramentaria = idFerramentaria;
    }

    const itensAtrasados = await prisma.itemEmprestimo.findMany({
      where,
      include: {
        emprestimo: {
          include: {
            colaborador: true,
            ferramentaria: true,
            ferramenteiro: true,
          },
        },
        itemFerramenta: {
          include: {
            ferramenta: true,
          },
        },
      },
      orderBy: {
        emprestimo: {
          dataPrevisaoDevolucao: 'asc',
        },
      },
    });

    const mapeados = itensAtrasados.map((item) => {
      const dataPrev = new Date(item.emprestimo.dataPrevisaoDevolucao!);
      const diffMs = agora.getTime() - dataPrev.getTime();
      const diasAtraso = Math.max(1, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
      const valor = Number(item.itemFerramenta.ferramenta.valorUnitario || 0);

      return {
        idItemEmprestimo: item.id,
        idEmprestimo: item.idEmprestimo,
        codigoIdentificador: item.itemFerramenta.codigoIdentificador,
        ferramenta: item.itemFerramenta.ferramenta.descricao,
        valorUnitario: valor,
        ferramentaria: item.emprestimo.ferramentaria.descricao,
        matriculaColaborador: item.emprestimo.colaborador.matricula,
        nomeColaborador: item.emprestimo.colaborador.nome,
        dataRetirada: item.emprestimo.dataHoraRetirada,
        dataPrevista: dataPrev,
        diasAtraso,
      };
    });

    const valorTotalRetido = mapeados.reduce((acc, curr) => acc + curr.valorUnitario, 0);

    return {
      totalItensAtrasados: mapeados.length,
      valorTotalRetido,
      itens: mapeados,
    };
  }

  /**
   * 4. Relatório de Perdas, Avarias e Baixas de Patrimônio
   */
  async getPerdasAvarias(filtros: { idFerramentaria?: number; dataInicio?: string; dataFim?: string }) {
    const where: any = {
      tipo: { in: ['BAIXA_AVARIA', 'BAIXA_EXTRAVIO'] },
    };

    if (filtros.idFerramentaria) {
      where.idFerramentaria = filtros.idFerramentaria;
    }

    if (filtros.dataInicio || filtros.dataFim) {
      where.dataHora = {};
      if (filtros.dataInicio) where.dataHora.gte = new Date(filtros.dataInicio);
      if (filtros.dataFim) {
        const d = new Date(filtros.dataFim);
        d.setHours(23, 59, 59, 999);
        where.dataHora.lte = d;
      }
    }

    const movimentacoes = await prisma.movimentacaoEstoque.findMany({
      where,
      orderBy: { dataHora: 'desc' },
      include: {
        ferramentaria: true,
        ferramenta: true,
        itemFerramenta: true,
        ferramenteiro: true,
        responsavelEntrega: true,
      },
    });

    const itens = movimentacoes.map((m) => {
      const valorUnit = Number(m.ferramenta?.valorUnitario || 0);
      const valorPrejuizo = valorUnit * m.quantidade;

      return {
        idMovimentacao: m.id,
        tipo: m.tipo,
        ferramentaria: m.ferramentaria?.descricao || 'N/A',
        codigoIdentificador: m.itemFerramenta?.codigoIdentificador || 'N/A',
        ferramenta: m.ferramenta?.descricao || 'N/A',
        quantidade: m.quantidade,
        valorUnitario: valorUnit,
        valorPrejuizo,
        dataHora: m.dataHora,
        motivoLaudo: m.motivo,
        ferramenteiro: m.ferramenteiro?.nome || 'N/A',
        responsavel: m.responsavelEntrega ? `${m.responsavelEntrega.nome} (${m.responsavelEntrega.matricula})` : 'N/A',
      };
    });

    const totalPrejuizo = itens.reduce((acc, curr) => acc + curr.valorPrejuizo, 0);

    return {
      totalOcorrencias: itens.length,
      totalPrejuizo,
      itens,
    };
  }

  /**
   * Exportador genérico para Excel (.xlsx) profissional com ExcelJS
   */
  async gerarExcel(
    titulo: string,
    colunas: { header: string; key: string; width: number; isCurrency?: boolean }[],
    dados: any[]
  ): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'CPRT - Sistema de Ferramentarias';
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet('Relatório');

    // Cabeçalho institucional (Linha 1 e 2)
    worksheet.mergeCells('A1', `${String.fromCharCode(64 + colunas.length)}1`);
    const titleCell = worksheet.getCell('A1');
    titleCell.value = `CONSÓRCIO PONTE RIO TOCANTINS - ${titulo.toUpperCase()}`;
    titleCell.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
    titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
    worksheet.getRow(1).height = 30;

    worksheet.mergeCells('A2', `${String.fromCharCode(64 + colunas.length)}2`);
    const subtitleCell = worksheet.getCell('A2');
    subtitleCell.value = `Emitido em: ${new Date().toLocaleString('pt-BR')} | Total de registros: ${dados.length}`;
    subtitleCell.font = { name: 'Calibri', size: 10, italic: true, color: { argb: 'FF94A3B8' } };
    subtitleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
    subtitleCell.alignment = { vertical: 'middle', horizontal: 'center' };
    worksheet.getRow(2).height = 20;

    // Linha em branco
    worksheet.addRow([]);

    // Configurar Colunas da Tabela (Linha 4)
    const headerRowNumber = 4;
    worksheet.getRow(headerRowNumber).values = colunas.map((c) => c.header);
    worksheet.getRow(headerRowNumber).height = 25;

    colunas.forEach((col, index) => {
      worksheet.getColumn(index + 1).width = col.width;
      const cell = worksheet.getCell(headerRowNumber, index + 1);
      cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } }; // Azul Royal
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'medium' },
        right: { style: 'thin' },
      };
    });

    // Inserir Dados
    dados.forEach((rowObj) => {
      const rowValues = colunas.map((col) => rowObj[col.key]);
      const addedRow = worksheet.addRow(rowValues);
      addedRow.height = 20;

      addedRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        const colDef = colunas[colNumber - 1];
        cell.font = { name: 'Calibri', size: 10 };
        cell.alignment = { vertical: 'middle' };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        };

        if (colDef?.isCurrency && typeof cell.value === 'number') {
          cell.numFmt = '"R$" #,##0.00';
          cell.alignment = { vertical: 'middle', horizontal: 'right' };
        }
      });
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  /**
   * Exportador genérico para PDF (.pdf) paisagem via PDFKit
   */
  async gerarPdf(
    titulo: string,
    colunas: { header: string; key: string; width: number; isCurrency?: boolean }[],
    dados: any[],
    resumoTexto?: string
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        layout: 'landscape',
        size: 'A4',
        margins: { top: 30, bottom: 30, left: 30, right: 30 },
      });

      const chunks: Buffer[] = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', (err) => reject(err));

      // Cabeçalho
      doc.rect(30, 30, 782, 45).fill('#0F172A');
      doc.fillColor('#38BDF8').font('Helvetica-Bold').fontSize(11)
        .text('CONSÓRCIO PONTE RIO TOCANTINS - SISTEMA DE FERRAMENTARIAS', 45, 40);
      doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(13)
        .text(titulo.toUpperCase(), 45, 54);
      doc.fillColor('#94A3B8').font('Helvetica').fontSize(8)
        .text(`Emissão: ${new Date().toLocaleString('pt-BR')}`, 630, 48, { align: 'right' });

      if (resumoTexto) {
        doc.fillColor('#334155').font('Helvetica-Bold').fontSize(8.5)
          .text(resumoTexto, 30, 85);
      }

      // Tabela de Dados
      let y = resumoTexto ? 100 : 85;
      const startX = 30;

      // Header da Tabela
      doc.rect(startX, y, 782, 20).fill('#2563EB');
      let curX = startX;
      doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(8);
      colunas.forEach((col) => {
        doc.text(col.header, curX + 4, y + 6, { width: col.width - 8, align: col.isCurrency ? 'right' : 'left' });
        curX += col.width;
      });

      y += 20;

      // Linhas da Tabela
      dados.slice(0, 35).forEach((row, idx) => {
        const bg = idx % 2 === 0 ? '#F8FAFC' : '#FFFFFF';
        doc.rect(startX, y, 782, 16).fill(bg);

        let colX = startX;
        doc.fillColor('#0F172A').font('Helvetica').fontSize(7.5);

        colunas.forEach((col) => {
          let val = row[col.key];
          if (col.isCurrency && typeof val === 'number') {
            val = `R$ ${val.toFixed(2)}`;
          } else if (val instanceof Date) {
            val = val.toLocaleDateString('pt-BR');
          } else if (val === null || val === undefined) {
            val = '-';
          } else {
            val = String(val);
          }

          doc.text(String(val).substring(0, 35), colX + 4, y + 4, {
            width: col.width - 8,
            align: col.isCurrency ? 'right' : 'left',
          });
          colX += col.width;
        });

        y += 16;
      });

      // Rodapé
      doc.fontSize(7).fillColor('#94A3B8').font('Helvetica')
        .text('Consórcio Ponte Rio Tocantins • Relatório Gerencial Analítico • CPRT', 30, 560, {
          align: 'center',
          width: 782,
        });

      doc.end();
    });
  }
}
