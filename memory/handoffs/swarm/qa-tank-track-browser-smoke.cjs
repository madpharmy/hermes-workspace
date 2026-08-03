const fs = require('node:fs')
const path = require('node:path')
const { chromium } = require('playwright')

const base = 'http://127.0.0.1:3000'
const sessionStore = 'C:/Users/madph/AppData/Local/hermes/workspace-sessions.json'
const outputDir = 'C:/Users/madph/Documents/Projects/hermes-workspace/memory/handoffs/swarm'
const screenshotPath = path.join(outputDir, 'qa-tank-track-swarm-board.png')
const reportPath = path.join(outputDir, 'qa-tank-track-browser-smoke.json')

async function main() {
  const store = JSON.parse(fs.readFileSync(sessionStore, 'utf8'))
  const now = Date.now()
  const valid = Object.entries(store.tokens || {}).filter(([, expiry]) => expiry > now)
  if (valid.length === 0) throw new Error('No unexpired Workspace session token is available')
  valid.sort((left, right) => right[1] - left[1])
  const token = valid[0][0]

  const browser = await chromium.launch({
    headless: true,
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  })
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
    await context.addCookies([{ name: 'claude-auth', value: token, url: base }])
    const page = await context.newPage()
    const consoleErrors = []
    const pageErrors = []
    const failedResponses = []
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text())
    })
    page.on('pageerror', (error) => pageErrors.push(error.message))
    page.on('response', (response) => {
      if (response.status() >= 400) {
        failedResponses.push({
          status: response.status(),
          url: response.url(),
          resourceType: response.request().resourceType(),
        })
      }
    })

    await page.goto(`${base}/swarm`, { waitUntil: 'domcontentloaded', timeout: 60000 })
    const boardButton = page.getByRole('button', { name: 'Board', exact: true })
    await boardButton.waitFor({ state: 'visible', timeout: 30000 })
    await boardButton.click()
    const region = page.getByRole('region', { name: 'Canonical print jobs' })
    await region.waitFor({ state: 'visible', timeout: 30000 })
    const regionText = await region.innerText()
    const buttons = await region.locator('button').allInnerTexts()
    const inputs = await region.locator('input').evaluateAll((elements) =>
      elements.map((element) => ({
        type: element.type,
        placeholder: element.placeholder,
        accept: element.accept,
      })),
    )
    const links = await region.locator('a').evaluateAll((elements) =>
      elements.map((element) => ({ text: element.innerText, href: element.getAttribute('href') })),
    )
    await region.screenshot({ path: screenshotPath })

    const report = {
      schema: 'qa.tank-track-browser-smoke.v1',
      url: page.url(),
      title: await page.title(),
      regionText,
      buttons,
      inputs,
      links,
      consoleErrors,
      pageErrors,
      failedResponses,
      screenshotPath,
    }
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`)
    console.log(JSON.stringify(report, null, 2))
  } finally {
    await browser.close()
  }
}

main().catch((error) => {
  console.error(error.stack || String(error))
  process.exitCode = 1
})
