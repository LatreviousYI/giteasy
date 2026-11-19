import { Builder, By, until } from 'selenium-webdriver'
import firefox from 'selenium-webdriver/firefox.js'
import fs from 'node:fs/promises'
import path from 'node:path'

const baseUrl = process.env.GITEASY_E2E_URL ?? 'http://127.0.0.1:1420'
const baselineRoot = path.resolve('docs/visual-baselines')

const options = new firefox.Options()
  .addArguments('-headless')
  .addArguments('--width=1440')
  .addArguments('--height=900')

const firefoxBinary =
  process.env.FIREFOX_BINARY ??
  (process.platform === 'darwin'
    ? '/Applications/Firefox.app/Contents/MacOS/firefox'
    : '/snap/firefox/current/usr/lib/firefox/firefox')

try {
  await fs.access(firefoxBinary)
  options.setBinary(firefoxBinary)
} catch {
  // Selenium/geckodriver will use its PATH lookup when no explicit binary exists.
}

const driver = await new Builder().forBrowser('firefox').setFirefoxOptions(options).build()

async function shot(relativePath, width, height) {
  await driver.manage().window().setRect({ width, height, x: 0, y: 0 })
  await driver.sleep(250)
  const target = path.join(baselineRoot, relativePath)
  await fs.mkdir(path.dirname(target), { recursive: true })
  await fs.writeFile(target, await driver.takeScreenshot(), 'base64')
}

try {
  await driver.get(`${baseUrl}/?view=changes`)
  await driver.wait(until.elementLocated(By.css('.app-shell')), 15_000)
  await driver.wait(until.elementLocated(By.css('.file-row')), 15_000)
  await driver.wait(until.elementLocated(By.css('.branch-tree-folder')), 10_000)
  await driver.findElement(By.css("[title='折叠分支目录 feature']")).click()
  await driver.wait(until.elementLocated(By.css("[title='展开分支目录 feature']")), 5_000)
  await driver.findElement(By.css("[title='展开分支目录 feature']")).click()

  await driver.executeScript(`
    const row = [...document.querySelectorAll('.list-row.branch-tree-leaf')]
      .find((item) => item.textContent.includes('◌') && item.textContent.includes('main'));
    row.dispatchEvent(new MouseEvent('contextmenu', {
      bubbles: true,
      cancelable: true,
      clientX: 360,
      clientY: 280,
      button: 2
    }));
  `)
  await driver.wait(until.elementLocated(By.xpath("//button[contains(., '创建本地分支')]")), 5_000)
  await driver.findElement(By.xpath("//button[contains(., '创建本地分支')]")).click()
  await driver.wait(until.elementLocated(By.css('.modal')), 5_000)
  const remoteCreateDefaults = await driver.executeScript(`
    const modal = document.querySelector('.modal');
    return {
      name: modal.querySelector('input.input').value,
      checkout: modal.querySelector('input[type=checkbox]').checked
    };
  `)
  if (remoteCreateDefaults.name !== 'main' || remoteCreateDefaults.checkout !== true) {
    throw new Error(`Unexpected remote create defaults: ${JSON.stringify(remoteCreateDefaults)}`)
  }
  await driver.findElement(By.css('.modal-head .icon-btn')).click()

  await driver.executeScript(`
    const row = [...document.querySelectorAll('.list-row.branch-tree-leaf')]
      .find((item) => !item.textContent.includes('◌') && item.textContent.includes('ui'));
    row.dispatchEvent(new MouseEvent('contextmenu', {
      bubbles: true,
      cancelable: true,
      clientX: 360,
      clientY: 280,
      button: 2
    }));
  `)
  const disabledPull = await driver.wait(
    until.elementLocated(By.xpath("//button[contains(., '无追踪上游')]")),
    5_000
  )
  if (await disabledPull.isEnabled()) {
    throw new Error('Pull without upstream should be disabled')
  }
  await driver.executeScript(`
    document.querySelector('.fixed.inset-0.z-40')
      .dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
  `)

  await shot('light/changes-1440.png', 1440, 900)
  const verticalScrollCheck = await driver.executeScript(`
    const body = document.querySelector('.diff-body');
    const filler = document.createElement('div');
    filler.style.height = '1200px';
    body.appendChild(filler);
    body.scrollTop = 320;
    const result = {
      clientHeight: body.clientHeight,
      scrollHeight: body.scrollHeight,
      scrollTop: body.scrollTop
    };
    filler.remove();
    body.scrollTop = 0;
    return result;
  `)
  if (
    verticalScrollCheck.scrollHeight <= verticalScrollCheck.clientHeight ||
    verticalScrollCheck.scrollTop <= 0
  ) {
    throw new Error(`Diff body cannot scroll vertically: ${JSON.stringify(verticalScrollCheck)}`)
  }
  const diffRowFillCheck = await driver.executeScript(`
    const body = document.querySelector('.diff-body');
    const line = body.querySelector('.diff-line.add, .diff-line.del');
    const code = line.querySelector('.code');
    const original = code.textContent;
    code.textContent = 'x'.repeat(500);
    const result = {
      bodyWidth: body.clientWidth,
      bodyScrollWidth: body.scrollWidth,
      lineWidth: line.getBoundingClientRect().width,
      lineMinWidth: getComputedStyle(line).minWidth,
      contentWidthVariable: getComputedStyle(body)
        .getPropertyValue('--diff-content-width').trim()
    };
    code.textContent = original;
    return result;
  `)
  if (
    diffRowFillCheck.lineWidth < diffRowFillCheck.bodyWidth ||
    diffRowFillCheck.lineWidth < diffRowFillCheck.bodyScrollWidth - 2 ||
    !diffRowFillCheck.lineMinWidth.endsWith('px') ||
    !diffRowFillCheck.contentWidthVariable.endsWith('px')
  ) {
    throw new Error(
      `Diff row background does not fill content width: ${JSON.stringify(diffRowFillCheck)}`
    )
  }
  await shot('light/changes-1280.png', 1280, 800)
  await shot('light/changes-1080.png', 1080, 720)

  await driver.findElement(By.xpath("//button[contains(., '历史')]")).click()
  await driver.wait(until.elementLocated(By.css('.commit-row')), 10_000)
  await driver.wait(until.elementLocated(By.css('.diff-body .diff-line')), 10_000)
  const historyRowFillCheck = await driver.executeScript(`
    const body = document.querySelector('.diff-body');
    const line = body.querySelector('.diff-line.add, .diff-line.del');
    return {
      bodyWidth: body.clientWidth,
      lineWidth: line.getBoundingClientRect().width,
      lineMinWidth: getComputedStyle(line).minWidth
    };
  `)
  if (
    historyRowFillCheck.lineWidth < historyRowFillCheck.bodyWidth - 2 ||
    !historyRowFillCheck.lineMinWidth.endsWith('px')
  ) {
    throw new Error(
      `History diff row background is too narrow: ${JSON.stringify(historyRowFillCheck)}`
    )
  }
  await shot('light/history-1440.png', 1440, 900)

  const initialFilesHeight = await driver.executeScript(`
    const pane = document.querySelector('.commit-files-pane');
    const handle = document.querySelector('.commit-files-resizer');
    const rect = handle.getBoundingClientRect();
    const startY = rect.top + rect.height / 2;
    handle.dispatchEvent(new PointerEvent('pointerdown', {
      bubbles: true,
      clientY: startY,
      pointerId: 1,
      pointerType: 'mouse',
      buttons: 1
    }));
    window.dispatchEvent(new PointerEvent('pointermove', {
      bubbles: true,
      clientY: startY + 80,
      pointerId: 1,
      pointerType: 'mouse',
      buttons: 1
    }));
    window.dispatchEvent(new PointerEvent('pointerup', {
      bubbles: true,
      clientY: startY + 80,
      pointerId: 1,
      pointerType: 'mouse'
    }));
    return pane.getBoundingClientRect().height;
  `)
  await driver.sleep(100)
  const resizedFilesHeight = await driver.executeScript(
    "return document.querySelector('.commit-files-pane').getBoundingClientRect().height"
  )
  if (resizedFilesHeight < initialFilesHeight + 60) {
    throw new Error(
      `History files pane did not resize: ${initialFilesHeight} -> ${resizedFilesHeight}`
    )
  }
  await driver.executeScript(`
    document.querySelector('.commit-files-resizer')
      .dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
  `)

  await driver.executeScript('document.querySelector("[title=\'Diff 显示选项\']").click()')
  const splitControlCount = await driver.executeScript(`
    return [...document.querySelectorAll('.diff-options-menu button')]
      .filter((button) => button.textContent.includes('分栏')).length +
      document.querySelectorAll('.diff-split-grid').length;
  `)
  if (splitControlCount > 0) {
    throw new Error(`Split diff controls still present: ${splitControlCount}`)
  }
  await driver.executeScript('document.querySelector("[title=\'Diff 显示选项\']").click()')

  await driver.findElement(By.css("[title='专注详情']")).click()
  await shot('light/history-focus-1440.png', 1440, 900)
  await driver.findElement(By.css("[title='显示提交列表']")).click()

  await driver.findElement(By.xpath("//button[contains(., '冲突')]")).click()
  await driver.wait(until.elementLocated(By.css('.conflict-pane')), 10_000)
  await shot('light/conflicts-1280.png', 1280, 800)

  await driver.executeScript("document.documentElement.dataset.theme='dark'")
  await shot('dark/conflicts-1280.png', 1280, 800)

  const initialVersionsHeight = await driver.executeScript(`
    const pane = document.querySelector('.conflict-versions');
    const splitter = document.querySelector('.conflict-splitter');
    const rect = splitter.getBoundingClientRect();
    const startY = rect.top + rect.height / 2;
    splitter.dispatchEvent(new PointerEvent('pointerdown', {
      bubbles: true,
      clientY: startY,
      pointerId: 2,
      pointerType: 'mouse',
      buttons: 1
    }));
    window.dispatchEvent(new PointerEvent('pointermove', {
      bubbles: true,
      clientY: startY + 80,
      pointerId: 2,
      pointerType: 'mouse',
      buttons: 1
    }));
    window.dispatchEvent(new PointerEvent('pointerup', {
      bubbles: true,
      clientY: startY + 80,
      pointerId: 2,
      pointerType: 'mouse'
    }));
    return pane.getBoundingClientRect().height;
  `)
  await driver.sleep(100)
  const resizedVersionsHeight = await driver.executeScript(
    "return document.querySelector('.conflict-versions').getBoundingClientRect().height"
  )
  if (resizedVersionsHeight < initialVersionsHeight + 50) {
    throw new Error(
      `Conflict versions pane did not resize: ${initialVersionsHeight} -> ${resizedVersionsHeight}`
    )
  }

  await driver.findElement(By.css("[title='GitHub']")).click()
  await driver.wait(until.elementLocated(By.css('.github-layout')), 10_000)
  await shot('dark/github-1280.png', 1280, 800)
  await driver.findElement(By.css('.modal-head .icon-btn')).click()

  const result = await driver.executeScript(`
    const overflow = [...document.querySelectorAll('*')].filter((element) => {
      const style = getComputedStyle(element);
      return element.scrollWidth > element.clientWidth + 2 &&
        style.overflowX === 'visible' &&
        element.clientWidth > 0;
    });
    return {
      title: document.title,
      theme: document.documentElement.dataset.theme,
      overflowCount: overflow.length,
      overflowElements: overflow.slice(0, 5).map((element) => ({
        tag: element.tagName,
        className: element.className,
        scrollWidth: element.scrollWidth,
        clientWidth: element.clientWidth
      })),
      fileRows: document.querySelectorAll('.file-row').length,
      branchFolders: document.querySelectorAll('.branch-tree-folder').length
    };
  `)
  console.log(JSON.stringify(result, null, 2))
} finally {
  await driver.quit()
}
