import { prisma } from '../../lib/prisma.js';
import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import crypto from 'crypto';

export class NadaConstaService {
  /**
   * Consulta o status de custódia e pendências de um colaborador
   */
  async consultarStatus(matriculaOuCredencial: string) {
    const termo = matriculaOuCredencial.trim();

    // Buscar colaborador por matrícula ou credencial RFID
    let colaborador = await prisma.pessoa.findUnique({
      where: { matricula: termo },
    });

    if (!colaborador) {
      colaborador = await prisma.pessoa.findFirst({
        where: {
          OR: [
            { credenciais: { contains: termo } },
            { nome: { contains: termo } },
          ],
        },
      });
    }

    if (!colaborador) {
      throw new Error(`Colaborador com identificador "${termo}" não foi localizado.`);
    }

    // Buscar ferramentas atualmente sob posse/custódia ativa (dataHoraDevolucao nula)
    const itensEmAberto = await prisma.itemEmprestimo.findMany({
      where: {
        emprestimo: {
          matriculaColaborador: colaborador.matricula,
        },
        dataHoraDevolucao: null,
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
      orderBy: {
        emprestimo: {
          dataHoraRetirada: 'desc',
        },
      },
    });

    // Mapear pendências detalhadas
    const pendencias = itensEmAberto.map((item) => {
      const valorUnit = Number(item.itemFerramenta.ferramenta.valorUnitario || 0);
      return {
        idItemEmprestimo: item.id,
        idEmprestimo: item.idEmprestimo,
        codigoIdentificador: item.itemFerramenta.codigoIdentificador,
        numeroTombo: item.itemFerramenta.numeroTombo,
        descricao: item.itemFerramenta.ferramenta.descricao,
        valorUnitario: valorUnit,
        ferramentariaOrigem: item.emprestimo.ferramentaria.descricao,
        idFerramentaria: item.emprestimo.idFerramentaria,
        dataHoraRetirada: item.emprestimo.dataHoraRetirada,
        dataPrevisaoDevolucao: item.emprestimo.dataPrevisaoDevolucao,
        ferramenteiroEntrega: item.emprestimo.ferramenteiro.nome,
        observacoes: item.emprestimo.observacoes,
      };
    });

    const totalItens = pendencias.length;
    const valorPatrimonialTotal = pendencias.reduce((acc, curr) => acc + curr.valorUnitario, 0);
    const liberado = totalItens === 0;

    return {
      status: liberado ? ('LIBERADO' as const) : ('PENDENTE' as const),
      liberado,
      totalItens,
      valorPatrimonialTotal,
      colaborador: {
        matricula: colaborador.matricula,
        nome: colaborador.nome,
        credenciais: colaborador.credenciais,
        situacao: colaborador.situacao,
        ativo: colaborador.ativo,
        observacao: colaborador.observacao,
      },
      pendencias,
      dataConsulta: new Date(),
      mensagem: liberado
        ? 'Colaborador liberado! Nenhuma pendência de ferramenta localizada.'
        : `Colaborador possui ${totalItens} ferramenta(s) pendente(s) de devolução no valor total de R$ ${valorPatrimonialTotal.toFixed(2)}.`,
    };
  }

  /**
   * Gera o PDF institucional da Certidão de "Nada Consta" (ou Espelho de Débitos)
   */
  async gerarCertidaoPdf(matricula: string, idUsuarioFerramenteiro?: number): Promise<Buffer> {
    const consulta = await this.consultarStatus(matricula);
    const colaborador = consulta.colaborador;

    // Buscar dados do ferramenteiro emissor se fornecido
    let ferramenteiroEmissor = 'Sistema Integrado CPRT';
    if (idUsuarioFerramenteiro) {
      const user = await prisma.usuario.findUnique({ where: { id: idUsuarioFerramenteiro } });
      if (user) ferramenteiroEmissor = `${user.nome} (${user.perfil})`;
    }

    const codigoAutenticidade = crypto.randomUUID().toUpperCase();
    const dataHoraEmissao = new Date().toLocaleString('pt-BR');

    // Gerar QR Code em buffer para verificação rápida
    const qrPayload = JSON.stringify({
      doc: 'NADA_CONSTA_CPRT',
      codigo: codigoAutenticidade,
      matricula: colaborador.matricula,
      nome: colaborador.nome,
      status: consulta.status,
      emissao: dataHoraEmissao,
    });
    const qrCodeBuffer = await QRCode.toBuffer(qrPayload, {
      type: 'png',
      width: 130,
      margin: 1,
    });

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 40, bottom: 40, left: 50, right: 50 },
      });

      const chunks: Buffer[] = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', (err) => reject(err));

      const isLiberado = consulta.liberado;

      // 1. Cabeçalho Institucional (Sem fundo, texto em preto)
      doc.fillColor('#000000').fontSize(13).font('Helvetica-Bold')
        .text('CONSÓRCIO PONTE RIO TOCANTINS - CPRT', 50, 45, { align: 'left' });
      doc.fillColor('#000000').fontSize(9).font('Helvetica')
        .text('CPRT - SISTEMA INTEGRADO DE GESTÃO DE FERRAMENTARIAS', 50, 62, { align: 'left' });
      doc.fillColor('#000000').fontSize(8).font('Helvetica')
        .text(`Emissão: ${dataHoraEmissao} | Protocolo: ${codigoAutenticidade.substring(0, 13)}`, 50, 77, { align: 'left' });

      // Linha divisória simples
      doc.moveTo(50, 95).lineTo(545, 95).lineWidth(0.75).strokeColor('#000000').stroke();

      // 2. Título do Documento (Texto em Preto)
      doc.fillColor('#000000').fontSize(13).font('Helvetica-Bold')
        .text(
          isLiberado
            ? 'CERTIDÃO NEGATIVA DE DÉBITOS PATRIMONIAIS ("NADA CONSTA")'
            : 'RELATÓRIO DE PENDÊNCIAS PATRIMONIAIS (FERRAMENTAS EMPRESTADAS)',
          50,
          120,
          { align: 'center', width: 495 }
        );

      // 3. Quadro de Dados do Colaborador (Texto em Preto)
      const boxTop = 155;
      doc.rect(50, boxTop, 495, 75).lineWidth(0.75).strokeColor('#000000').stroke();
      doc.fillColor('#000000').fontSize(10).font('Helvetica-Bold')
        .text('DADOS DO COLABORADOR:', 65, boxTop + 12);

      doc.font('Helvetica').fontSize(9).fillColor('#000000');
      doc.text(`Nome Completo: `, 65, boxTop + 30, { continued: true })
        .font('Helvetica-Bold').text(colaborador.nome);

      doc.font('Helvetica').text(`Matrícula / ID: `, 65, boxTop + 45, { continued: true })
        .font('Helvetica-Bold').text(colaborador.matricula);

      doc.font('Helvetica').text(`Situação no RH: `, 300, boxTop + 45, { continued: true })
        .font('Helvetica-Bold').fillColor('#000000')
        .text(colaborador.situacao === 1 ? 'ATIVO / LIBERADO' : 'INATIVO / BLOQUEADO');

      if (colaborador.credenciais) {
        doc.font('Helvetica').fillColor('#000000')
          .text(`Crachá(s) RFID: ${colaborador.credenciais}`, 65, boxTop + 60);
      }

      // 4. Parecer Oficial (Texto em Preto e sem carimbo)
      if (isLiberado) {
        doc.fillColor('#000000').font('Helvetica').fontSize(10).text(
          `Certificamos para os devidos fins de homologação trabalhista, rescisão contratual, transferência de frente de obra ou desmobilização, que o(a) colaborador(a) acima identificado(a) NÃO POSSUI QUALQUER FERRAMENTA, MÁQUINA, EQUIPAMENTO OU INSTRUMENTO PATRIMONIAL sob sua guarda ou responsabilidade em nenhuma das ferramentarias ativas da CPRT.`,
          50,
          boxTop + 95,
          { align: 'justify', width: 495, lineGap: 4 }
        );
      } else {
        doc.fillColor('#000000').font('Helvetica-Bold').fontSize(10).text(
          `CONSTATAM-SE PENDÊNCIAS PATRIMONIAIS: O(a) colaborador(a) possui ${consulta.totalItens} ferramenta(s) em aberto que ainda NÃO foram devolvidas, totalizando R$ ${consulta.valorPatrimonialTotal.toFixed(2)} em patrimônio sob sua custódia:`,
          50,
          boxTop + 95,
          { align: 'justify', width: 495, lineGap: 2 }
        );

        // Tabela de Ferramentas Retidas
        let tableY = boxTop + 140;
        doc.rect(50, tableY, 495, 20).lineWidth(0.75).strokeColor('#000000').stroke();
        doc.fillColor('#000000').font('Helvetica-Bold').fontSize(8);
        doc.text('CÓDIGO', 55, tableY + 6);
        doc.text('DESCRIÇÃO DA FERRAMENTA', 175, tableY + 6);
        doc.text('FERRAMENTARIA', 320, tableY + 6);
        doc.text('VALOR (R$)', 420, tableY + 6);
        doc.text('RETIRADA EM', 475, tableY + 6);

        tableY += 20;
        doc.font('Helvetica').fontSize(7.5);
        for (const it of consulta.pendencias.slice(0, 10)) {
          const colCodigoW = 115;
          const colDescW = 140;
          const colOrigemW = 95;
          const colValorW = 50;
          const colDataW = 60;

          const hCodigo = doc.heightOfString(it.codigoIdentificador || '', { width: colCodigoW });
          const hDesc = doc.heightOfString(it.descricao || '', { width: colDescW });
          const hOrigem = doc.heightOfString(it.ferramentariaOrigem || '', { width: colOrigemW });
          const hValor = doc.heightOfString(`R$ ${it.valorUnitario.toFixed(2)}`, { width: colValorW });
          const dataFormatada = it.dataHoraRetirada ? new Date(it.dataHoraRetirada).toLocaleDateString('pt-BR') : '-';
          const hData = doc.heightOfString(dataFormatada, { width: colDataW });

          const maxContentHeight = Math.max(hCodigo, hDesc, hOrigem, hValor, hData);
          const rowHeight = Math.max(18, maxContentHeight + 8);

          doc.rect(50, tableY, 495, rowHeight).lineWidth(0.5).strokeColor('#666666').stroke();
          doc.fillColor('#000000').font('Helvetica').fontSize(7.5);

          const textY = tableY + 4;
          doc.text(it.codigoIdentificador, 55, textY, { width: colCodigoW });
          doc.text(it.descricao, 175, textY, { width: colDescW });
          doc.text(it.ferramentariaOrigem, 320, textY, { width: colOrigemW });
          doc.text(`R$ ${it.valorUnitario.toFixed(2)}`, 420, textY, { width: colValorW });
          doc.text(dataFormatada, 475, textY, { width: colDataW });

          tableY += rowHeight;
        }
      }

      // 5. Bloco de Autenticidade, Assinatura e QR Code
      const authY = 630;
      doc.rect(50, authY, 495, 120).lineWidth(0.75).strokeColor('#000000').stroke();

      // Inserir QR Code
      doc.image(qrCodeBuffer, 65, authY + 10, { width: 100 });

      // Dados de Autenticidade
      doc.fillColor('#000000').font('Helvetica-Bold').fontSize(9)
        .text('AUTENTICAÇÃO E RASTREABILIDADE DIGITAL', 180, authY + 15);

      doc.font('Helvetica').fontSize(8).fillColor('#000000');
      doc.text(`Chave de Validação: `, 180, authY + 32, { continued: true })
        .font('Helvetica-Bold').text(codigoAutenticidade);

      doc.font('Helvetica').text(`Ferramenteiro Emissor: `, 180, authY + 46, { continued: true })
        .font('Helvetica-Bold').text(ferramenteiroEmissor);

      doc.font('Helvetica').text(`Data / Hora de Geração: `, 180, authY + 60, { continued: true })
        .font('Helvetica-Bold').text(dataHoraEmissao);

      doc.font('Helvetica').fontSize(7.5).fillColor('#000000')
        .text(
          'A autenticidade deste documento pode ser verificada instantaneamente apontando a câmera para o QR Code ao lado ou consultando o código identificador no sistema central da ferramentaria.',
          180,
          authY + 76,
          { width: 350, lineGap: 2 }
        );

      // Rodapé Final
      doc.fontSize(7).fillColor('#000000').font('Helvetica')
        .text('Consórcio Ponte Rio Tocantins • Gestão Integrada de Almoxarifados e Ferramentarias • Página 1 de 1', 50, 770, { align: 'center', width: 495 });

      doc.end();
    });
  }
}
