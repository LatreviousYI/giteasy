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

const driver = await new Builder()
  .forBrowser('firefox')
  .setFirefoxOptions(options)
  .build()

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
    throw new Error(
      `Diff body cannot scroll vertically: ${JSON.stringify(verticalScrollCheck)}`
    )
  }
  await shot('light/changes-1280.png', 1280, 800)
  await shot('light/changes-1080.png', 1080, 720)

  await driver.findElement(By.xpath("//button[contains(., '历史')]")).click()
  await driver.wait(until.elementLocated(By.css('.commit-row')), 10_000)
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

  await driver.executeScript(
    "document.querySelector(\"[title='Diff 显示选项']\").click()"
  )
  const splitControlCount = await driver.executeScript(`
    return [...document.querySelectorAll('.diff-options-menu button')]
      .filter((button) => button.textContent.includes('分栏')).length +
      document.querySelectorAll('.diff-split-grid').length;
  `)
  if (splitControlCount > 0) {
    throw new Error(`Split diff controls still present: ${splitControlCount}`)
  }
  await driver.executeScript(
    "document.querySelector(\"[title='Diff 显示选项']\").click()"
  )

  await driver.findElement(By.css("[title='专注详情']")).click()
  await shot('light/history-focus-1440.png', 1440, 900)
  await driver.findElement(By.css("[title='显示提交列表']")).click()

  await driver.findElement(By.xpath("//button[contains(., '冲突')]")).click()
  await driver.wait(until.elementLocated(By.css('.conflict-pane')), 10_000)
  await shot('light/conflicts-1280.png', 1280, 800)

  await driver.executeScript("document.documentElement.dataset.theme='dark'")
  await shot('dark/conflicts-1280.png', 1280, 800)

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
      fileRows: document.querySelectorAll('.file-row').length
    };
  `)
  console.log(JSON.stringify(result, null, 2))
} finally {
  await driver.quit()
}
