import puppeteer from 'puppeteer';
import path from 'path';

const ARTIFACT_DIR = 'C:\\Users\\thiag\\.gemini\\antigravity-ide\\brain\\282228e1-a132-46fb-a9cd-e62e1da7d917';

async function capture() {
  console.log('Iniciando Puppeteer para captura de evidências visuais da Fase 4...');

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  // 1. Login
  console.log('1. Acessando login...');
  await page.goto('http://localhost:5173/login', { waitUntil: 'networkidle2' });

  await page.type('input[type="text"]', 'admin');
  await page.type('input[type="password"]', 'Dimep@123');
  await page.click('button[type="submit"]');

  await page.waitForNavigation({ waitUntil: 'networkidle2' });
  console.log('   Login realizado com sucesso.');

  // 2. Movimentações Page
  console.log('2. Acessando /movimentacoes...');
  await page.goto('http://localhost:5173/movimentacoes', { waitUntil: 'networkidle2' });
  await page.waitForSelector('table tbody tr');
  await new Promise((r) => setTimeout(r, 1000));

  const pathMovimentacoes = path.join(ARTIFACT_DIR, 'fase4_movimentacoes_page.png');
  await page.screenshot({ path: pathMovimentacoes });
  console.log(`   Screenshot salva: ${pathMovimentacoes}`);

  // 3. Modal Nova Entrada
  console.log('3. Abrindo Modal Nova Entrada...');
  // Clique no botão Nova Entrada
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const btn = buttons.find((b) => b.textContent?.includes('Nova Entrada de Estoque'));
    if (btn) btn.click();
  });
  await new Promise((r) => setTimeout(r, 800));

  const pathModalEntrada = path.join(ARTIFACT_DIR, 'fase4_modal_entrada.png');
  await page.screenshot({ path: pathModalEntrada });
  console.log(`   Screenshot salva: ${pathModalEntrada}`);

  // Fechar modal entrada
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const btn = buttons.find((b) => b.textContent?.includes('Cancelar'));
    if (btn) btn.click();
  });
  await new Promise((r) => setTimeout(r, 500));

  // 4. Modal Registrar Baixa
  console.log('4. Abrindo Modal Baixa...');
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const btn = buttons.find((b) => b.textContent?.includes('Registrar Baixa / Avaria'));
    if (btn) btn.click();
  });
  await new Promise((r) => setTimeout(r, 800));

  const pathModalBaixa = path.join(ARTIFACT_DIR, 'fase4_modal_baixa.png');
  await page.screenshot({ path: pathModalBaixa });
  console.log(`   Screenshot salva: ${pathModalBaixa}`);

  // Fechar modal baixa
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const btn = buttons.find((b) => b.textContent?.includes('Cancelar'));
    if (btn) btn.click();
  });
  await new Promise((r) => setTimeout(r, 500));

  // 5. Auditoria Page
  console.log('5. Acessando /auditoria...');
  await page.goto('http://localhost:5173/auditoria', { waitUntil: 'networkidle2' });
  await page.waitForSelector('table tbody tr');
  await new Promise((r) => setTimeout(r, 1000));

  const pathAuditoria = path.join(ARTIFACT_DIR, 'fase4_auditoria_page.png');
  await page.screenshot({ path: pathAuditoria });
  console.log(`   Screenshot salva: ${pathAuditoria}`);

  // 6. Abrir Detalhes do Log
  console.log('6. Abrindo modal de detalhes do log...');
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const btn = buttons.find((b) => b.textContent?.trim() === 'Ver');
    if (btn) btn.click();
  });
  await new Promise((r) => setTimeout(r, 800));

  const pathModalLog = path.join(ARTIFACT_DIR, 'fase4_modal_detalhes_log.png');
  await page.screenshot({ path: pathModalLog });
  console.log(`   Screenshot salva: ${pathModalLog}`);

  await browser.close();
  console.log('Todas as evidências da Fase 4 foram capturadas com sucesso!');
}

capture().catch((err) => {
  console.error('Erro na captura:', err);
  process.exit(1);
});
