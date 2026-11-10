// Renders a horizontal "flowing branch" mind map to SVG → PNG.
//
// Two canvases: a warm-dark one for the dark UI and a warm-paper one for the
// light UI. Same geometry, different ink.

import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const WIDTH = 1040
const MARGIN_X = 30
const ROOT_W = 252
const BRANCH_X = 430
const BRANCH_W = 244
const LEAF_X = 712
const LEAF_W = 300
const GAP_Y = 26
const LEAF_GAP = 12

const FONT_STACK = "'Microsoft YaHei','PingFang SC','Noto Sans CJK SC',sans-serif"
const FONT_SERIF = "'Songti SC','Noto Serif SC','Source Han Serif SC','SimSun',Georgia,serif"
const FONT_SANS = "'PingFang SC','Microsoft YaHei UI','Microsoft YaHei','Segoe UI',sans-serif"
const ROOT_TEXT_W = 232

const THEMES = {
  dark: {
    accents: ['#a9bba6', '#9fb0c4', '#c9a9a0', '#c6b092', '#b0a3b8', '#91b6b0'],
    bg: '#121419',
    ink: '#f2eee6',
    leaf: 'rgba(236,230,220,0.78)',
    branchInk: '#f0ebe1',
    rootA: '#333a44',
    rootB: '#262b34',
    rootC: '#1d2129',
    rootStroke: 'rgba(236,230,220,0.16)',
    rootHighlight: 'rgba(255,255,255,0.10)',
    glowA: '#a9bba6',
    glowB: '#9fb0c4',
    footer: 'rgba(236,230,220,0.22)',
    branchFill: 0.18,
    branchStroke: 0.5,
  },
  light: {
    accents: ['#6d7f5c', '#5c7186', '#a2675c', '#96703c', '#6d6183', '#5d8b83'],
    bg: '#f6f2ea',
    ink: '#23211d',
    leaf: 'rgba(35,33,29,0.76)',
    branchInk: '#23211d',
    rootA: '#ffffff',
    rootB: '#f4edE1',
    rootC: '#ebe2d3',
    rootStroke: 'rgba(35,33,29,0.18)',
    rootHighlight: 'rgba(255,255,255,0.75)',
    glowA: '#6d7f5c',
    glowB: '#5c7186',
    footer: 'rgba(35,33,29,0.26)',
    branchFill: 0.16,
    branchStroke: 0.42,
  },
}

function isWide(code) {
  return code > 0x2e7f && code !== 0x2014 && code !== 0x2013
}

function charWidth(char, size) {
  const code = char.codePointAt(0)
  if (isWide(code)) return size
  if ('iljtfrI.,:;!|\'`'.includes(char)) return size * 0.34
  if ('mwMW@%'.includes(char)) return size * 0.86
  return size * 0.57
}

function textWidth(text, size) {
  let total = 0
  for (const char of text) total += charWidth(char, size)
  return total
}

function wrapText(text, size, maxWidth) {
  const source = String(text ?? '').replace(/\s+/g, ' ').trim()
  if (!source) return ['']
  const lines = []
  let line = ''
  let width = 0
  const tokens = source.match(/[A-Za-z0-9@#%&+./:_-]+|\s+|./gu) ?? [source]
  for (const token of tokens) {
    const tokenWidth = textWidth(token, size)
    if (width + tokenWidth > maxWidth && line.trim() !== '') {
      lines.push(line.trimEnd())
      line = token === ' ' ? '' : token
      width = token === ' ' ? 0 : tokenWidth
      continue
    }
    line += token
    width += tokenWidth
  }
  if (line.trim() !== '') lines.push(line.trimEnd())
  const result = lines.length > 0 ? lines : [source]
  // Never let a line begin with closing punctuation: pull it up a line.
  const closing = /^[。，、；：！？）」』”’.,;:!?)]$/
  for (let index = 1; index < result.length; index += 1) {
    while (result[index].length > 0 && closing.test(result[index][0])) {
      result[index - 1] += result[index][0]
      result[index] = result[index].slice(1)
    }
  }
  return result.filter(text => text.length > 0)
}

function measureNode(text, size, maxWidth, lineHeight, paddingY) {
  const lines = wrapText(text, size, maxWidth)
  return { lines, height: lines.length * lineHeight + paddingY * 2 }
}

function escapeXml(value) {
  return String(value).replace(/[<>&"']/g, char => ({
    '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;',
  })[char])
}

function textBlock(node, x, y, size, weight, fill, anchor = 'start') {
  const lineHeight = size * 1.55
  const startY = y - ((node.lines.length - 1) * lineHeight) / 2
  return node.lines.map((line, index) => `<text x="${x}" y="${startY + index * lineHeight}" `
    + `font-family="${FONT_STACK}" font-size="${size}" font-weight="${weight}" `
    + `fill="${fill}" text-anchor="${anchor}" dominant-baseline="middle">${escapeXml(line)}</text>`).join('')
}

function curve(x1, y1, x2, y2, color, width, opacity) {
  const dx = Math.max(46, (x2 - x1) * 0.56)
  return `<path d="M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}" `
    + `fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" opacity="${opacity}"/>`
}

/**
 * Build the mind map document.
 *
 * @param {{ center: string, branches: Array<{ title: string, items?: string[] }> }} spec
 * @param {'dark'|'light'} mode canvas ink.
 * @returns {{ html: string, width: number, height: number }}
 */
export function buildMindmap(spec, mode = 'dark') {
  const theme = THEMES[mode] ?? THEMES.dark
  const center = String(spec.center ?? '思维导图').slice(0, 40)
  const branches = (Array.isArray(spec.branches) ? spec.branches : [])
    .slice(0, 6)
    .map((branch, index) => ({
      title: String(branch?.title ?? '').slice(0, 48),
      items: (Array.isArray(branch?.items) ? branch.items : []).slice(0, 5).map(item => String(item).slice(0, 96)),
      color: theme.accents[index % theme.accents.length],
    }))
    .filter(branch => branch.title.length > 0)

  // No boxes: the root is set as a display line, branches as coloured labels,
  // leaves as plain text. Geometry stays so the eye still reads left → right.
  const rootNode = measureNode(center, 25, ROOT_TEXT_W, 40, 10)
  const branchNodes = branches.map(branch => ({
    ...branch,
    node: measureNode(branch.title, 16, BRANCH_W + 20, 26, 8),
    leaves: branch.items.map(item => measureNode(item, 13.5, LEAF_W, 22, 6)),
  }))

  let cursor = 0
  const blocks = branchNodes.map(branch => {
    const leavesHeight = branch.leaves.reduce((sum, leaf) => sum + leaf.height, 0)
      + Math.max(0, branch.leaves.length - 1) * LEAF_GAP
    const blockHeight = Math.max(branch.node.height, leavesHeight)
    const block = { branch, top: cursor, height: blockHeight, leavesHeight }
    cursor += blockHeight + GAP_Y
    return block
  })

  const contentHeight = Math.max(cursor - GAP_Y, rootNode.height, 300)
  const height = Math.round(contentHeight + 90)
  const offsetY = (height - contentHeight) / 2
  const rootY = offsetY + contentHeight / 2
  const leafTopOf = block => offsetY + block.top + (block.height - block.leavesHeight) / 2

  const rootWidth = Math.max(...rootNode.lines.map(line => textWidth(line, 25)), 120)
  const rootRight = MARGIN_X + 18 + rootWidth
  const parts = []

  parts.push('<defs>'
    + '<radialGradient id="glowA" cx="0.16" cy="0.04" r="0.8">'
    + '<stop offset="0" stop-color="' + theme.glowA + '" stop-opacity="0.10"/>'
    + '<stop offset="1" stop-color="' + theme.glowA + '" stop-opacity="0"/>'
    + '</radialGradient>'
    + '<radialGradient id="glowB" cx="0.92" cy="0.96" r="0.75">'
    + '<stop offset="0" stop-color="' + theme.glowB + '" stop-opacity="0.08"/>'
    + '<stop offset="1" stop-color="' + theme.glowB + '" stop-opacity="0"/>'
    + '</radialGradient>'
    + '</defs>')
  parts.push('<rect width="' + WIDTH + '" height="' + height + '" fill="' + theme.bg + '"/>')
  parts.push('<rect width="' + WIDTH + '" height="' + height + '" fill="url(#glowA)"/>')
  parts.push('<rect width="' + WIDTH + '" height="' + height + '" fill="url(#glowB)"/>')

  // Hairline connectors first.
  blocks.forEach(block => {
    const branch = block.branch
    const branchY = offsetY + block.top + block.height / 2
    const labelWidth = Math.max(...branch.node.lines.map(line => textWidth(line, 16)), 60)
    parts.push(curve(rootRight, rootY, BRANCH_X - 18, branchY, branch.color, 1.1, 0.55))
    let leafCursor = leafTopOf(block)
    branch.leaves.forEach(leaf => {
      const leafY = leafCursor + leaf.height / 2
      parts.push(curve(BRANCH_X + 12 + labelWidth + 14, branchY, LEAF_X - 14, leafY, branch.color, 0.8, 0.35))
      leafCursor += leaf.height + LEAF_GAP
    })
  })

  // Root: display serif, a slim accent rule, no container.
  parts.push('<rect x="' + MARGIN_X + '" y="' + (rootY - rootNode.height / 2) + '" width="3" height="' + rootNode.height + '" rx="1.5" fill="' + theme.accents[0] + '"/>')
  rootNode.lines.forEach((line, index) => {
    const lineHeight = 25 * 1.5
    const startY = rootY - ((rootNode.lines.length - 1) * lineHeight) / 2
    parts.push('<text x="' + (MARGIN_X + 18) + '" y="' + (startY + index * lineHeight) + '" '
      + 'font-family="' + FONT_SERIF + '" font-size="25" font-weight="700" '
      + 'fill="' + theme.ink + '" dominant-baseline="middle">' + escapeXml(line) + '</text>')
  })

  blocks.forEach(block => {
    const branch = block.branch
    const branchY = offsetY + block.top + block.height / 2

    parts.push('<circle cx="' + BRANCH_X + '" cy="' + branchY + '" r="3" fill="' + branch.color + '"/>')
    branch.node.lines.forEach((line, index) => {
      const lineHeight = 16 * 1.6
      const startY = branchY - ((branch.node.lines.length - 1) * lineHeight) / 2
      parts.push('<text x="' + (BRANCH_X + 12) + '" y="' + (startY + index * lineHeight) + '" '
        + 'font-family="' + FONT_SANS + '" font-size="16" font-weight="600" '
        + 'fill="' + branch.color + '" dominant-baseline="middle">' + escapeXml(line) + '</text>')
    })

    let leafCursor = leafTopOf(block)
    branch.leaves.forEach(leaf => {
      const leafY = leafCursor + leaf.height / 2
      parts.push('<circle cx="' + (LEAF_X - 14) + '" cy="' + leafY + '" r="1.8" fill="' + branch.color + '" opacity="0.8"/>')
      leaf.lines.forEach((line, index) => {
        const lineHeight = 13.5 * 1.55
        const startY = leafY - ((leaf.lines.length - 1) * lineHeight) / 2
        parts.push('<text x="' + (LEAF_X - 2) + '" y="' + (startY + index * lineHeight) + '" '
          + 'font-family="' + FONT_SANS + '" font-size="13.5" font-weight="400" '
          + 'fill="' + theme.leaf + '" dominant-baseline="middle">' + escapeXml(line) + '</text>')
      })
      leafCursor += leaf.height + LEAF_GAP
    })
  })

  parts.push('<text x="' + (WIDTH - 26) + '" y="' + (height - 20) + '" text-anchor="end" font-family="' + FONT_SANS + '" '
    + 'font-size="10" letter-spacing="3" fill="' + theme.footer + '">BETWEEN PAGES</text>')

  const html = '<!doctype html>\n<html><head><meta charset="utf-8"><style>\n'
    + 'html,body{margin:0;padding:0;background:' + theme.bg + ';width:' + WIDTH + 'px;height:' + height + 'px;overflow:hidden}\n'
    + '</style></head><body>\n'
    + '<svg xmlns="http://www.w3.org/2000/svg" width="' + WIDTH + '" height="' + height + '" viewBox="0 0 ' + WIDTH + ' ' + height + '">\n'
    + parts.join('\n')
    + '\n</svg></body></html>'

  return { html, width: WIDTH, height }
}


function pngSize(buffer) {
  if (buffer.length < 24) return undefined
  if (buffer.readUInt32BE(0) !== 0x89504e47) return undefined
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) }
}

const WINDOWS_BROWSERS = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
]

const MAC_BROWSERS = [
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
]

const LINUX_BROWSERS = [
  '/usr/bin/microsoft-edge',
  '/usr/bin/microsoft-edge-stable',
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/snap/bin/chromium',
]

const BROWSER_CANDIDATES = [
  ...(process.platform === 'win32' ? WINDOWS_BROWSERS : []),
  ...(process.platform === 'darwin' ? MAC_BROWSERS : []),
  ...(process.platform === 'linux' ? LINUX_BROWSERS : []),
  // a browser installed somewhere unusual can still be pointed at explicitly
  ...(process.platform === 'win32' ? [] : [...MAC_BROWSERS.slice(0, 1), ...LINUX_BROWSERS.slice(0, 1)]),
]

function findBrowser() {
  const fromEnv = process.env.DSH_MINDMAP_BROWSER
  const candidates = fromEnv ? [fromEnv, ...BROWSER_CANDIDATES] : BROWSER_CANDIDATES
  for (const candidate of candidates) {
    try {
      if (readFileSync(candidate).length > 0) return candidate
    } catch {
      // try the next well-known location
    }
  }
  return undefined
}

/**
 * Render one mind map to PNG.
 *
 * @param {object} spec the mind map tree.
 * @param {string} output absolute PNG path.
 * @param {{ theme?: 'dark'|'light', timeoutMs?: number }} options render options.
 * @returns {Promise<{ ok: boolean, width?: number, height?: number, message?: string }>}
 */
export async function renderMindmapPng(spec, output, options = {}) {
  const { html, width, height } = buildMindmap(spec, options.theme === 'light' ? 'light' : 'dark')
  const dir = mkdtempSync(join(tmpdir(), 'dsh-mindmap-'))
  const htmlFile = join(dir, 'map.html')
  writeFileSync(htmlFile, html, 'utf8')

  const browser = findBrowser()
  if (browser === undefined) {
    return { ok: false, message: '没有找到可用的 Edge/Chrome，无法把思维导图渲染成图片（可用环境变量 DSH_MINDMAP_BROWSER 指定浏览器路径）' }
  }

  const args = [
    '--headless=new',
    '--disable-gpu',
    '--hide-scrollbars',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-extensions',
    '--force-device-scale-factor=2',
    `--screenshot=${output}`,
    `--window-size=${width},${height}`,
    `file:///${htmlFile.replace(/\\/g, '/')}`,
  ]

  const timeoutMs = options.timeoutMs ?? 20_000
  const exitCode = await new Promise(resolve => {
    const child = spawn(browser, args, { stdio: 'ignore', windowsHide: true })
    const timer = setTimeout(() => {
      child.kill()
      resolve(-1)
    }, timeoutMs)
    child.on('error', () => {
      clearTimeout(timer)
      resolve(-1)
    })
    child.on('exit', code => {
      clearTimeout(timer)
      resolve(code ?? 0)
    })
  })

  try {
    const buffer = readFileSync(output)
    const size = pngSize(buffer)
    if (size === undefined || buffer.length < 1024) {
      return { ok: false, message: `浏览器退出码 ${exitCode}，但没有生成有效图片` }
    }
    return { ok: true, width: size.width, height: size.height }
  } catch {
    return { ok: false, message: `浏览器退出码 ${exitCode}，图片没有写出` }
  }
}
