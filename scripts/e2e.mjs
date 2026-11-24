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
  const remoteMenuText = await driver.executeScript(
    "return document.querySelector('.branch-context-menu')?.textContent || ''"
  )
  for (const label of [
    '合并到当前分支',
    '变基当前分支到此分支',
    'Squash 合并到当前分支',
    'Cherry-pick 提交',
    '重置当前分支到此分支',
    '创建标签',
    '从该远程分支拉取当前分支',
    '删除远程分支'
  ]) {
    if (!remoteMenuText.includes(label)) {
      throw new Error(`Remote branch menu is missing ${label}`)
    }
  }
  const remotePull = await driver.findElement(
    By.xpath("//button[contains(., '从该远程分支拉取当前分支')]")
  )
  if (!(await remotePull.isEnabled())) {
    throw new Error('Remote pull should be enabled for the tracked origin/main branch')
  }
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
    until.elementLocated(By.xpath("//button[contains(., '该分支没有追踪上游')]")),
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

  const openedCommitShort = await driver.executeScript(`
    const row = document.querySelector('.commit-row:not(.stash-row)');
    const shortOid = row.querySelector('.commit-meta .mono').textContent;
    row.dispatchEvent(new MouseEvent('contextmenu', {
      bubbles: true,
      cancelable: true,
      clientX: 520,
      clientY: 260,
      button: 2
    }));
    return shortOid;
  `)
  const commitMenuText = await driver.executeScript(
    "return document.querySelector('.commit-context-menu')?.textContent || ''"
  )
  for (const label of [
    'Cherry-pick 到当前分支',
    '回滚此提交',
    '重置当前分支到此提交',
    '从此提交后交互式变基',
    '创建并检出分支',
    '在此外创建标签',
    '检出此提交',
    '复制完整哈希'
  ]) {
    if (!commitMenuText.includes(label)) {
      throw new Error(`Commit menu is missing ${label}`)
    }
  }
  const hoverTarget = await driver.findElement(
    By.xpath("//div[contains(@class, 'commit-context-menu')]//button[not(@disabled)][1]")
  )
  await driver.actions().move({ origin: hoverTarget }).perform()
  const hoverStyle = await driver.executeScript(
    `
      const style = getComputedStyle(arguments[0]);
      return {
        background: style.backgroundColor,
        boxShadow: style.boxShadow
      };
    `,
    hoverTarget
  )
  if (
    hoverStyle.background === 'rgba(0, 0, 0, 0)' ||
    !hoverStyle.boxShadow ||
    hoverStyle.boxShadow === 'none'
  ) {
    throw new Error(`Context menu item hover state is missing: ${JSON.stringify(hoverStyle)}`)
  }
  await driver.findElement(By.xpath("//button[contains(., '在此外创建标签')]")).click()
  const tagDialogText = await driver.findElement(By.css('.modal')).getText()
  if (!tagDialogText.includes(openedCommitShort)) {
    throw new Error('Commit tag dialog does not use the selected commit as its start point')
  }
  await driver.findElement(By.css('.modal-head .icon-btn')).click()

  await driver.executeScript(`
    const row = document.querySelector('.commit-row:not(.stash-row)');
    row.dispatchEvent(new MouseEvent('contextmenu', {
      bubbles: true,
      cancelable: true,
      clientX: 520,
      clientY: 260,
      button: 2
    }));
  `)
  await driver.findElement(By.xpath("//button[contains(., '创建并检出分支')]")).click()
  const branchDefault = await driver.findElement(By.css('.modal input.input')).getAttribute('value')
  if (branchDefault !== `branch-from-${openedCommitShort}`) {
    throw new Error(`Unexpected branch default: ${branchDefault}`)
  }
  await driver.findElement(By.css('.modal-head .icon-btn')).click()

  await driver.executeScript(`
    const row = document.querySelector('.commit-row:not(.stash-row)');
    row.dispatchEvent(new MouseEvent('contextmenu', {
      bubbles: true,
      cancelable: true,
      clientX: 520,
      clientY: 260,
      button: 2
    }));
  `)
  await driver.findElement(By.xpath("//button[contains(., '重置当前分支到此提交')]")).click()
  const resetDialogText = await driver.findElement(By.css('.modal')).getText()
  if (!resetDialogText.includes(openedCommitShort)) {
    throw new Error('Commit reset dialog does not show the selected commit')
  }
  await driver.findElement(By.css('.modal-head .icon-btn')).click()

  await driver.executeScript(`
    const row = document.querySelector('.commit-row:not(.stash-row)');
    row.focus();
    row.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'F10',
      shiftKey: true,
      bubbles: true,
      cancelable: true
    }));
  `)
  await driver.wait(until.elementLocated(By.css('.commit-context-menu')), 5_000)
  await driver.executeScript(`
    document.querySelector('.fixed.inset-0.z-40')
      .dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
  `)

  await driver.executeScript(`
    const row = [...document.querySelectorAll('.commit-row:not(.stash-row)')]
      .find((item) => item.textContent.includes('merge:'));
    row.dispatchEvent(new MouseEvent('contextmenu', {
      bubbles: true,
      cancelable: true,
      clientX: 520,
      clientY: 300,
      button: 2
    }));
  `)
  const mergeCherryPick = await driver.findElement(
    By.xpath("//button[contains(., 'Cherry-pick 到当前分支')]")
  )
  const mergeRevert = await driver.findElement(By.xpath("//button[contains(., '回滚此提交')]"))
  if ((await mergeCherryPick.isEnabled()) || (await mergeRevert.isEnabled())) {
    throw new Error('Merge commit should not allow cherry-pick or revert')
  }
  await driver.executeScript(`
    document.querySelector('.fixed.inset-0.z-40')
      .dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
  `)
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
  await driver.wait(until.elementLocated(By.css('.conflict-code-grid')), 10_000)
  const initialConflictProgress = await driver
    .findElement(By.css('.conflict-block-progress'))
    .getText()
  if (!initialConflictProgress.replace(/\s/g, '').includes('第1/3块')) {
    throw new Error(`Unexpected initial conflict progress: ${initialConflictProgress}`)
  }
  const activeConflictLines = async () =>
    driver.executeScript(`
      return [...document.querySelectorAll('.conflict-code-pane')].map((pane) => {
        const container = pane.querySelector('.conflict-code-lines');
        const active = pane.querySelector('[data-conflict-highlight="true"]');
        if (!container || !active) return { text: '', visible: false };
        const containerRect = container.getBoundingClientRect();
        const activeRect = active.getBoundingClientRect();
        return {
          text: active.textContent || '',
          visible: activeRect.top >= containerRect.top - 1 &&
            activeRect.bottom <= containerRect.bottom + 1
        };
      });
    `)
  const initialActiveLines = await activeConflictLines()
  if (
    initialActiveLines.length !== 2 ||
    !initialActiveLines[0].text.includes('theirs first') ||
    !initialActiveLines[1].text.includes('ours first') ||
    initialActiveLines.some((item) => !item.visible)
  ) {
    throw new Error(
      `Initial conflict block is not correctly focused: ${JSON.stringify(initialActiveLines)}`
    )
  }
  await shot('light/conflicts-1280.png', 1280, 800)

  await driver.executeScript("document.documentElement.dataset.theme='dark'")
  await shot('dark/conflicts-1280.png', 1280, 800)

  await driver.findElement(By.css("[title='下一块']")).click()
  const nextConflictProgress = await driver
    .findElement(By.css('.conflict-block-progress'))
    .getText()
  if (!nextConflictProgress.replace(/\s/g, '').includes('第2/3块')) {
    throw new Error(`Conflict navigation did not advance: ${nextConflictProgress}`)
  }
  const secondActiveLines = await activeConflictLines()
  if (
    !secondActiveLines[0].text.includes('theirs second') ||
    !secondActiveLines[1].text.includes('ours second') ||
    secondActiveLines.some((item) => !item.visible)
  ) {
    throw new Error(
      `Second conflict block is not correctly focused: ${JSON.stringify(secondActiveLines)}`
    )
  }
  await driver.findElement(By.css("[title='下一块']")).click()
  const thirdActiveLines = await activeConflictLines()
  if (
    !thirdActiveLines[0].text.includes('theirs third') ||
    !thirdActiveLines[1].text.includes('ours third') ||
    thirdActiveLines.some((item) => !item.visible)
  ) {
    throw new Error(
      `Third conflict block is not correctly focused: ${JSON.stringify(thirdActiveLines)}`
    )
  }
  await driver.findElement(By.css("[title='上一块']")).click()
  await driver.findElement(By.xpath("//button[normalize-space(.)='采用对方']")).click()
  const afterResolveMarkers = await driver.executeScript(`
    return (document.querySelector('.conflict-result-textarea').value.match(/^<<<<<<</gm) || []).length
  `)
  if (afterResolveMarkers !== 2) {
    throw new Error(`Expected two remaining conflict blocks, received ${afterResolveMarkers}`)
  }
  await driver.findElement(By.css("[title='撤销上一步']")).click()
  const afterUndoMarkers = await driver.executeScript(`
    return (document.querySelector('.conflict-result-textarea').value.match(/^<<<<<<</gm) || []).length
  `)
  if (afterUndoMarkers !== 3) {
    throw new Error(`Conflict undo did not restore all blocks: ${afterUndoMarkers}`)
  }

  const initialVersionsHeight = await driver.executeScript(`
    const pane = document.querySelector('.conflict-merge-top');
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
    "return document.querySelector('.conflict-merge-top').getBoundingClientRect().height"
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
