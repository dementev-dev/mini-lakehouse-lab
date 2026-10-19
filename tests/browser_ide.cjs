// Запуск через browser_ide.sh: настоящий notebook editor, локальное ядро и webview.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const notebookName = 'lakehouse-browser-smoke.ipynb';
const notebook = JSON.parse(fs.readFileSync(
  path.join(__dirname, '../notebooks/01_environment_and_smoke_test.ipynb'), 'utf8',
));
const smokeCell = notebook.cells.findIndex(cell =>
  cell.source.join('').includes('smoke_report = run_cluster_smoke(spark)'),
);

async function openNotebook(page) {
  await page.keyboard.press('Control+p');
  await page.keyboard.type(`/tmp/${notebookName}`);
  await page.getByRole('option').filter({ hasText: notebookName }).first().waitFor();
  await page.keyboard.press('Enter');
  await page.getByRole('list', { name: /Notebook Use/ }).waitFor();
}

async function checkOutput(page) {
  // Notebook editor виртуализирует ячейки: сначала показываем нужную ячейку.
  const list = page.getByRole('list', { name: /Notebook Use/ });
  await list.press('Control+Home');
  for (let i = 0; i < smokeCell; i++) await list.press('ArrowDown');
  await page.getByRole('button', {
    name: `Cell ${smokeCell + 1} of ${notebook.cells.length}`, exact: true,
  }).waitFor();

  for (let attempt = 0; attempt < 30; attempt++) {
    for (const frame of page.frames()) {
      const output = frame.getByText('result_sum=499999500000', { exact: false });
      if (await output.count() && await output.first().isVisible()) return;
    }
    await page.waitForTimeout(500);
  }
  throw new Error('Notebook webview did not render the expected Spark result');
}

(async () => {
  assert(smokeCell >= 0, 'Module 1 must contain the cluster smoke cell');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.setDefaultTimeout(30000);
  const webviewErrors = [];
  page.on('console', message => {
    if (/Error loading webview|Could not register.*service.?worker/i.test(message.text())) {
      webviewErrors.push(message.text());
    }
  });
  try {
    await page.goto(process.env.IDE_URL || 'http://localhost:8889', {
      waitUntil: 'domcontentloaded',
    });
    assert(await page.evaluate(() => isSecureContext && 'serviceWorker' in navigator));
    await page.getByRole('tree', { name: 'Files Explorer' }).waitFor();
    // Баннер появляется позже Explorer; при повторном тесте доверие уже сохранено.
    const restricted = page.getByRole('banner').filter({ hasText: 'Restricted Mode' });
    await restricted.waitFor({ timeout: 10000 }).catch(error => {
      if (error.name !== 'TimeoutError') throw error;
    });
    if (await restricted.count()) {
      await restricted.getByRole('button', { name: 'Manage', exact: true }).click();
      await page.getByRole('button', { name: 'Trust', exact: true }).click();
      await page.getByRole('button', { name: 'Close Modal Editor (Escape)' }).click();
      await restricted.waitFor({ state: 'hidden' });
    }
    console.log('PASS: workspace trust enabled');

    await openNotebook(page);
    await page.getByRole('button', { name: 'Select Kernel', exact: true }).click();
    await page.getByRole('option', { name: 'Python Environments...' }).click();
    await page.getByRole('option').filter({ hasText: '/usr/bin/python3' }).click();
    console.log('PASS: notebook editor and local Python kernel selection');

    await page.getByRole('button', { name: 'Run All', exact: true }).click();
    await page.getByRole('button', { name: 'Interrupt', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Run All', exact: true }).waitFor({ timeout: 120000 });
    await checkOutput(page);
    await page.keyboard.press('Control+s');
    console.log('PASS: Spark output rendered in notebook webview over HTTP localhost');

    await page.getByRole('tab', { name: notebookName, exact: true })
      .getByRole('button', { name: 'Close (Ctrl+W)' }).click();
    await openNotebook(page);
    await checkOutput(page);
    assert.deepEqual(webviewErrors, []);
    await page.screenshot({ path: '/artifacts/notebook.png' });
    await page.getByRole('tab', { name: notebookName, exact: true })
      .getByRole('button', { name: 'Close (Ctrl+W)' }).click();
    console.log('PASS: saved notebook reopened with its output');
  } catch (error) {
    await page.screenshot({ path: '/artifacts/failure.png' }).catch(() => {});
    throw error;
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
