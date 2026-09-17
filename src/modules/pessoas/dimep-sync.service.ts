import fs from 'fs';
import path from 'path';
import xlsx from 'xlsx';
import puppeteer, { Browser } from 'puppeteer';
import { prisma } from '../../lib/prisma.js';
import { env } from '../../config/env.js';

export interface SyncResult {
  sucesso: boolean;
  registrosProcessados: number;
  inativados: number;
  mensagem: string;
  dataHora: string;
}

export class DimepSyncService {
  /**
   * Processa uma lista de linhas extraídas de uma planilha da Dimep
   */
  async processRows(rows: any[], syncStartTime: Date): Promise<{ countUpsert: number; countInativados: number }> {
    let countUpsert = 0;

    for (const row of rows) {
      const keys = Object.keys(row);
      let matricula: any, nome: any, situacaoStr: any, credenciais: any, observacao: any;

      for (const key of keys) {
        const normKey = key.trim().toLowerCase();
        if (normKey.includes('matrícula') || normKey.includes('matricula')) matricula = row[key];
        else if (normKey.includes('nome')) nome = row[key];
        else if (normKey.includes('situação') || normKey.includes('situacao')) situacaoStr = row[key];
        else if (normKey.includes('credencial') || normKey.includes('credenciais')) credenciais = row[key];
        else if (normKey.includes('observação') || normKey.includes('observacao')) observacao = row[key];
      }

      if (!matricula) continue;

      let situacaoInt = 1; // Padrão Liberado
      if (situacaoStr) {
        const strLower = situacaoStr.toString().toLowerCase();
        if (strLower.includes('bloqueado')) {
          situacaoInt = 0;
        } else if (strLower.includes('permitido') || strLower.includes('liberado')) {
          situacaoInt = 1;
        }
      }

      const matStr = matricula.toString().trim();
      const nomeStr = nome ? nome.toString().trim() : 'Sem Nome';
      const credStr = credenciais ? credenciais.toString().trim() : null;
      const obsStr = observacao ? observacao.toString().trim() : null;

      const batchTimestamp = new Date(syncStartTime.getTime() + 1000);

      await prisma.pessoa.upsert({
        where: { matricula: matStr },
        update: {
          nome: nomeStr,
          credenciais: credStr,
          situacao: situacaoInt,
          observacao: obsStr,
          dataUltimaSincronizacao: batchTimestamp,
          ativo: true,
        },
        create: {
          matricula: matStr,
          nome: nomeStr,
          credenciais: credStr,
          situacao: situacaoInt,
          observacao: obsStr,
          dataUltimaSincronizacao: batchTimestamp,
          ativo: true,
        },
      });
      countUpsert++;
    }

    // Inativação de colaboradores ausentes na lista importada
    let countInativados = 0;
    if (countUpsert > 0) {
      const result = await prisma.pessoa.updateMany({
        where: {
          dataUltimaSincronizacao: {
            lt: syncStartTime,
          },
          ativo: true,
        },
        data: { ativo: false },
      });
      countInativados = result.count;
    }

    return { countUpsert, countInativados };
  }

  /**
   * Processa diretamente o buffer de uma planilha enviada por upload
   */
  async processBuffer(buffer: Buffer): Promise<{ countUpsert: number; countInativados: number }> {
    const workbook = xlsx.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    // Lê a partir da linha 11 (range: 10 em base 0)
    const rows = xlsx.utils.sheet_to_json(sheet, { range: 10, raw: true });

    const syncStartTime = new Date();
    return this.processRows(rows, syncStartTime);
  }

  /**
   * Conecta com o portal Dimep AMS via Puppeteer, faz download do relatório e sincroniza
   */
  async runDimepSync(): Promise<SyncResult> {
    const downloadPath = path.resolve('./temp_dimep_downloads');
    if (!fs.existsSync(downloadPath)) {
      fs.mkdirSync(downloadPath, { recursive: true });
    }

    const waitForDownload = (dir: string, timeout = 60000): Promise<string | null> => {
      return new Promise((resolve) => {
        const before = new Set(fs.readdirSync(dir));
        const interval = setInterval(() => {
          const after = fs.readdirSync(dir);
          const newFiles = after.filter(
            (f) =>
              !before.has(f) &&
              ['.xls', '.xlsx', '.csv'].some((ext) => f.toLowerCase().endsWith(ext)) &&
              !f.endsWith('.crdownload')
          );
          if (newFiles.length > 0) {
            clearInterval(interval);
            clearTimeout(timer);
            resolve(path.join(dir, newFiles[0]));
          }
        }, 500);

        const timer = setTimeout(() => {
          clearInterval(interval);
          resolve(null);
        }, timeout);
      });
    };

    let browser: Browser | null = null;
    const syncStartTime = new Date(Date.now() - 10000);

    try {
      console.log('[DIMEP SYNC] Iniciando navegador Puppeteer...');
      browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });

      const page = await browser.newPage();
      const client = await page.createCDPSession();
      await client.send('Page.setDownloadBehavior', {
        behavior: 'allow',
        downloadPath: downloadPath,
      });

      const username = env.AUTOSYNC_USER || 'mixestec';
      const password = env.AUTOSYNC_PASS || 'Dimep@123';

      console.log('[DIMEP SYNC] Acessando página de logon Dimep...');
      await page.goto('https://ponteriotocantins.dimep-ams.com.br/logon.aspx', {
        waitUntil: 'networkidle2',
        timeout: 30000,
      });

      await page.waitForSelector('#txtUsrLogin', { visible: true });
      await page.type('#txtUsrLogin', username, { delay: 30 });
      await page.type('#txtUserPassLogin', password, { delay: 30 });

      await Promise.all([
        page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }),
        page.click('#Submit1'),
      ]);

      console.log('[DIMEP SYNC] Navegando para relatório de pessoas...');
      await page.goto(
        'https://ponteriotocantins.dimep-ams.com.br/Reports/ProcessPluginReport.aspx?idPlugin=27',
        { waitUntil: 'networkidle2', timeout: 30000 }
      );

      const selectSelector = '#MainContentMainMaster_MainContent_ctl00_ddlGenerateType';
      await page.waitForSelector(selectSelector, { visible: true });
      await page.select(selectSelector, '4'); // Excel

      const btnSelector = '#MainContentMainMaster_MainContent_ctl00_btnGenerate';
      await page.waitForSelector(btnSelector, { visible: true });
      await page.click(btnSelector);

      console.log('[DIMEP SYNC] Aguardando download do Excel...');
      const downloadedFile = await waitForDownload(downloadPath, 60000);

      if (!downloadedFile) {
        throw new Error('Tempo limite excedido aguardando o download do arquivo no portal Dimep.');
      }

      console.log(`[DIMEP SYNC] Arquivo baixado: ${downloadedFile}. Processando...`);
      const workbook = xlsx.readFile(downloadedFile);
      const sheetName = workbook.SheetNames[0];
      const rows = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], { range: 10, raw: true });

      const { countUpsert, countInativados } = await this.processRows(rows, syncStartTime);

      // Limpeza de arquivos temporários
      try {
        fs.unlinkSync(downloadedFile);
        fs.rmdirSync(downloadPath);
      } catch {}

      return {
        sucesso: true,
        registrosProcessados: countUpsert,
        inativados: countInativados,
        mensagem: `Sincronização com Dimep AMS concluída com sucesso. ${countUpsert} colaboradores atualizados/criados e ${countInativados} inativados.`,
        dataHora: new Date().toISOString(),
      };
    } catch (error: any) {
      console.error('[DIMEP SYNC] Erro durante a sincronização:', error.message);
      // Limpeza da pasta temporária em caso de erro
      try {
        if (fs.existsSync(downloadPath)) {
          const files = fs.readdirSync(downloadPath);
          for (const f of files) fs.unlinkSync(path.join(downloadPath, f));
          fs.rmdirSync(downloadPath);
        }
      } catch {}

      throw new Error(`Falha na sincronização Dimep AMS: ${error.message}`);
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }
}
