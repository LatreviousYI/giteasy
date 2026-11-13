import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

function argument(name) {
  const index = process.argv.indexOf(`--${name}`)
  return index >= 0 ? process.argv[index + 1] : undefined
}

const target = argument('target')
const asset = argument('asset')
const signature = argument('signature')
const output = argument('output')

if (!target || !asset || !signature || !output) {
  throw new Error(
    'usage: generate-updater-manifest.mjs --target <target> --asset <file> --signature <file> --output <file>'
  )
}

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const packageJson = JSON.parse(
  await fs.readFile(path.join(root, 'package.json'), 'utf8')
)
const signatureText = (await fs.readFile(signature, 'utf8')).trim()
if (!signatureText) throw new Error(`empty updater signature: ${signature}`)

const assetName = path.basename(asset)
const url = `https://github.com/LatreviousYI/giteasy/releases/download/v${packageJson.version}/${encodeURIComponent(assetName)}`
const manifest = {
  version: packageJson.version,
  notes: `GitEasy v${packageJson.version}`,
  pub_date: new Date().toISOString(),
  platforms: {
    [target]: {
      signature: signatureText,
      url
    }
  }
}

await fs.mkdir(path.dirname(output), { recursive: true })
await fs.writeFile(output, `${JSON.stringify(manifest, null, 2)}\n`)
console.log(output)
