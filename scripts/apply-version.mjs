import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

const version = process.argv[2]
if (!/^\d+\.\d+\.\d+$/.test(version ?? '')) {
  throw new Error(`invalid release version: ${version ?? ''}`)
}

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')

async function replaceOnce(relativePath, pattern, replacement) {
  const target = path.join(root, relativePath)
  const source = await fs.readFile(target, 'utf8')
  if (!pattern.test(source)) {
    throw new Error(`could not find version in ${relativePath}`)
  }
  pattern.lastIndex = 0
  await fs.writeFile(target, source.replace(pattern, replacement))
}

async function replaceVersion(relativePath, count) {
  const target = path.join(root, relativePath)
  const source = await fs.readFile(target, 'utf8')
  let replaced = 0
  const updated = source.replace(/("version"\s*:\s*")[^"]+(")/g, (match, prefix, suffix) => {
    if (replaced >= count) return match
    replaced += 1
    return `${prefix}${version}${suffix}`
  })
  if (replaced !== count) {
    throw new Error(`expected ${count} versions in ${relativePath}, found ${replaced}`)
  }
  await fs.writeFile(target, updated)
}

await replaceVersion('package.json', 1)
await replaceVersion('package-lock.json', 2)
await replaceVersion('src-tauri/tauri.conf.json', 1)

await replaceOnce(
  'src-tauri/Cargo.toml',
  /(\[package\][\s\S]*?\nversion\s*=\s*")[^"]+(")/,
  `$1${version}$2`
)

await replaceOnce(
  'src-tauri/Cargo.lock',
  /(\[\[package\]\]\nname = "giteasy"\nversion = ")[^"]+(")/,
  `$1${version}$2`
)

console.log(`Applied release version ${version}`)
