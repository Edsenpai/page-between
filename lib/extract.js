// Zero-dependency HTML → readable Markdown extraction for article pages.
//
// The goal is not a general HTML parser: it is "give me the article body and
// throw away the furniture". Everything here is synchronous and pure so the
// host tool can call it inside a normal tool execution.

const VOID_TAGS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta',
  'param', 'source', 'track', 'wbr',
])

const DROP_TAGS = new Set([
  'script', 'style', 'noscript', 'svg', 'canvas', 'iframe', 'form', 'button',
  'select', 'option', 'textarea', 'template', 'object', 'video', 'audio',
  'map', 'marquee', 'dialog', 'aside', 'nav', 'footer', 'menu',
])

const BLOCK_TAGS = new Set([
  'address', 'article', 'blockquote', 'center', 'dd', 'details', 'div', 'dl',
  'dt', 'fieldset', 'figcaption', 'figure', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'header', 'hr', 'li', 'main', 'ol', 'p', 'pre', 'section', 'summary', 'table',
  'tbody', 'td', 'tfoot', 'th', 'thead', 'tr', 'ul',
])

// Substrings in class/id/role that almost always mark site furniture rather
// than article prose. Matched as whole tokens so "navigation" hits and
// "navy" does not.
const JUNK_ATTR = /(^|[\s_-])(comment|comments|commentlist|reply|replies|share|sharing|social|related|recommend|recommended|promo|promotion|advert|advertisement|ads|adslot|adsbygoogle|banner|cookie|consent|subscribe|subscription|newsletter|paywall|login|signin|signup|register|breadcrumb|breadcrumbs|sidebar|side|navbar|navigation|menu|toolbar|pagination|pager|sponsor|sponsored|popup|modal|overlay|float|widget|outbrain|taboola|disqus|copyright|readmore|read-more|more-stories|related-posts|editsection|edit-section|navbox|catlinks|printfooter|noprint|toc|tuijian|pinglun|fenxiang|daohang)([\s_-]|$)/i

const CHROME_LINE = /^(分享|分享到|收藏|点赞|在看|阅读原文|上一篇|下一篇|相关阅读|相关文章|相关推荐|你可能还喜欢|推荐阅读|免责声明|版权声明|本文链接|责任编辑|编辑：|作者：\s*$|扫码|关注公众号)[：: ]?.*$/

const ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ensp: ' ',
  emsp: ' ', thinsp: ' ', zwnj: '', zwj: '', shy: '', hellip: '…', mdash: '—',
  ndash: '–', lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”', laquo: '«',
  raquo: '»', middot: '·', bull: '•', times: '×', divide: '÷', deg: '°',
  copy: '©', reg: '®', trade: '™', sect: '§', para: '¶', dagger: '†',
  permil: '‰', prime: '′', Prime: '″', euro: '€', pound: '£', yen: '¥',
  cent: '¢', larr: '←', rarr: '→', uarr: '↑', darr: '↓', harr: '↔',
  ne: '≠', le: '≤', ge: '≥', asymp: '≈', infin: '∞', minus: '−',
}

function decodeEntities(input) {
  if (!input || input.indexOf('&') === -1) return input
  return input.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]*);/g, (whole, body) => {
    if (body[0] === '#') {
      const code = body[1] === 'x' || body[1] === 'X'
        ? Number.parseInt(body.slice(2), 16)
        : Number.parseInt(body.slice(1), 10)
      if (!Number.isFinite(code) || code <= 0 || code > 0x10ffff) return whole
      try {
        return String.fromCodePoint(code)
      } catch {
        return whole
      }
    }
    const named = ENTITIES[body]
    return named === undefined ? whole : named
  })
}

function cleanText(input) {
  return decodeEntities(String(input ?? ''))
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '')
    .replace(/[\u00a0\u2000-\u200a\u202f\u205f\u3000]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function parseAttributes(raw) {
  const attrs = {}
  if (!raw) return attrs
  const re = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'`=<>]+)))?/g
  let match
  while ((match = re.exec(raw)) !== null) {
    const name = match[1].toLowerCase()
    const value = match[2] ?? match[3] ?? match[4] ?? ''
    if (!(name in attrs)) attrs[name] = decodeEntities(value)
  }
  return attrs
}

function elementText(node) {
  let out = ''
  for (const child of node.children) {
    if (child.tag === '#text') out += child.text
    else if (!DROP_TAGS.has(child.tag)) out += elementText(child)
  }
  return out
}

function linkText(node) {
  let out = ''
  for (const child of node.children) {
    if (child.tag === 'a') out += elementText(child)
    else if (child.tag !== '#text') out += linkText(child)
  }
  return out
}

function visibleLength(node) {
  return cleanText(elementText(node)).length
}

function isHidden(node) {
  const style = node.attrs && node.attrs.style
  if (style && /display\s*:\s*none/i.test(style)) return true
  if (node.attrs && node.attrs.hidden !== undefined) return true
  if (node.attrs && node.attrs['aria-hidden'] === 'true') return true
  return false
}

function isJunk(node) {
  if (!node.attrs) return false
  const attrBag = [node.attrs.class, node.attrs.id, node.attrs.role, node.attrs['aria-label'], node.attrs['data-testid']]
    .filter(Boolean).join(' ')
  if (!attrBag) return false
  return JUNK_ATTR.test(` ${attrBag.toLowerCase()} `)
}

function isBlockTag(tag) {
  return BLOCK_TAGS.has(tag)
}

/** Implicitly closed tags, so `<p>a<p>b` and `<li>x<li>y` still nest sanely. */
function autoCloses(openTag, nextTag) {
  if (openTag === nextTag && ['p', 'li', 'tr', 'td', 'th', 'dt', 'dd', 'option'].includes(openTag)) return true
  if (openTag === 'p' && isBlockTag(nextTag)) return true
  if ((openTag === 'td' || openTag === 'th') && (nextTag === 'td' || nextTag === 'th' || nextTag === 'tr')) return true
  if (openTag === 'tr' && nextTag === 'tr') return true
  if (openTag === 'dt' && (nextTag === 'dt' || nextTag === 'dd')) return true
  if (openTag === 'dd' && (nextTag === 'dt' || nextTag === 'dd')) return true
  return false
}

/**
 * Build a lightweight element tree. Unknown or malformed tags are tolerated:
 * unmatched closes are ignored and the stack is walked back when possible.
 */
function buildTree(html) {
  const root = { tag: '#root', attrs: {}, children: [] }
  const stack = [root]
  const re = /<!--[\s\S]*?-->|<![^>]*>|<\/([a-zA-Z][\w:-]*)\s*>|<([a-zA-Z][\w:-]*)((?:[^>"']|"[^"]*"|'[^']*')*)>/g
  let cursor = 0
  let match

  const pushText = (text) => {
    if (!text) return
    const top = stack[stack.length - 1]
    top.children.push({ tag: '#text', text })
  }

  while ((match = re.exec(html)) !== null) {
    if (match.index > cursor) pushText(html.slice(cursor, match.index))
    cursor = re.lastIndex
    if (match[1] !== undefined) {
      const closeTag = match[1].toLowerCase()
      for (let i = stack.length - 1; i > 0; i--) {
        if (stack[i].tag === closeTag) {
          stack.length = i
          break
        }
      }
      continue
    }
    if (match[2] === undefined) continue // comment or doctype
    const tag = match[2].toLowerCase()
    const rawAttrs = match[3] || ''
    const selfClosing = /\/\s*$/.test(rawAttrs)
    const attrs = parseAttributes(rawAttrs.replace(/\/\s*$/, ''))

    // Implicit close of the current paragraph / list item / cell.
    while (stack.length > 1 && autoCloses(stack[stack.length - 1].tag, tag)) stack.pop()

    const parent = stack[stack.length - 1]
    const node = { tag, attrs, children: [] }
    parent.children.push(node)

    if (VOID_TAGS.has(tag) || selfClosing) continue
    stack.push(node)
  }
  if (cursor < html.length) pushText(html.slice(cursor))
  return root
}

const SCORE_BLOCKS = new Set(['p', 'blockquote', 'h2', 'h3', 'h4', 'pre'])

/** Cache raw text, link, and prose-block counts once, so scoring stays O(1). */
function measure(node) {
  let len = 0
  let link = 0
  let blocks = 0
  for (const child of node.children) {
    if (child.tag === '#text') {
      len += child.text.length
      continue
    }
    measure(child)
    len += child.len
    blocks += child.blocks
    if (child.tag === 'a') link += child.len
    else link += child.link
  }
  if (SCORE_BLOCKS.has(node.tag)) blocks += 1
  node.len = len
  node.link = link
  node.blocks = blocks
  return len
}

/** Remove junk, hidden, and dropped elements in place. */
function prune(node) {
  const parentLen = Math.max(1, node.len)
  const guarded = node.tag === '#root' || node.tag === 'html' || node.tag === 'body'
  const kept = []
  for (const child of node.children) {
    if (child.tag === '#text') {
      kept.push(child)
      continue
    }
    if (DROP_TAGS.has(child.tag)) continue
    if (isHidden(child)) continue
    // A junk-looking class on a page-sized container (Wikipedia puts
    // "…-menu-…" utility classes on <body>) must not delete the article.
    const untouchable = guarded || child.tag === 'article' || child.tag === 'main' || child.tag === 'html' || child.tag === 'body'
    if (!untouchable && isJunk(child)) {
      const own = child.len
      const density = own === 0 ? 1 : child.link / own
      if (own < parentLen * 0.6 || density > 0.45) continue
    }
    prune(child)
    kept.push(child)
  }
  node.children = kept
}

function findFirst(node, tags) {
  for (const child of node.children) {
    if (child.tag === '#text') continue
    if (tags.has(child.tag)) return child
    const nested = findFirst(child, tags)
    if (nested) return nested
  }
  return null
}

function collect(node, tags, out = []) {
  for (const child of node.children) {
    if (child.tag === '#text') continue
    if (tags.has(child.tag)) out.push(child)
    collect(child, tags, out)
  }
  return out
}

function scoreNode(node) {
  const length = node.len || 0
  if (length < 40) return 0
  const linkDensity = length === 0 ? 1 : (node.link || 0) / length
  let score = length * (1 - Math.min(0.9, linkDensity)) + (node.blocks || 0) * 90
  if (node.tag === 'article' || node.tag === 'main') score *= 1.15
  if (node.tag === 'body') score *= 0.8
  return score
}

/** Descend into the single child that holds most of the prose, if any. */
function descendToProse(start, startScore) {
  let best = start
  let bestScore = startScore
  const candidates = new Set(['div', 'section', 'article', 'main', 'td'])
  for (;;) {
    let next = null
    let nextScore = 0
    for (const child of best.children) {
      if (child.tag === '#text' || !candidates.has(child.tag)) continue
      const score = scoreNode(child)
      if (score > nextScore) {
        next = child
        nextScore = score
      }
    }
    if (next === null || nextScore < bestScore * 0.8) return best
    best = next
    bestScore = nextScore
  }
}

function pickContent(root) {
  const body = findFirst(root, new Set(['body'])) || root
  const candidates = collect(body, new Set(['article', 'main', 'section', 'div', 'td']))
  let best = body
  let bestScore = scoreNode(body) * 0.5
  for (const node of candidates) {
    const score = scoreNode(node)
    if (score > bestScore) {
      best = node
      bestScore = score
    }
  }
  // A page whose <article> is only slightly smaller than the best <div> is
  // still better: it carries the author's own boundaries.
  const explicit = findFirst(body, new Set(['article', 'main']))
  if (explicit) {
    const explicitScore = scoreNode(explicit)
    if (explicitScore > 0 && explicitScore >= bestScore * 0.55) {
      best = explicit
      bestScore = explicitScore
    }
  }
  return descendToProse(best, bestScore)
}

/**
 * Fallback for pages whose body is bare text separated by <br> instead of <p>
 * (status posts, 讨论-style pages): walk the node and rebuild paragraphs.
 */
function renderLooseText(node, ctx) {
  const out = []
  let buffer = []
  const flush = () => {
    const text = tidyInline(buffer.join(' ')).trim()
    if (text) out.push(text)
    buffer = []
  }
  const walk = current => {
    for (const child of current.children || []) {
      if (child.tag === '#text') {
        buffer.push(decodeEntities(child.text))
        continue
      }
      if (child.tag === 'br') { flush(); continue }
      if (child.tag === 'img') {
        const src = resolveUrl(child.attrs['data-src'] || child.attrs.src, ctx.baseUrl)
        if (src && !/^data:/.test(src)) { flush(); out.push(`![](${src})`) }
        continue
      }
      if (child.tag === 'a') {
        const label = tidyInline(elementText(child)).trim()
        const href = resolveUrl(child.attrs.href, ctx.baseUrl)
        buffer.push(href && !href.startsWith('#') && label ? `[${label}](${href})` : label)
        continue
      }
      if (child.tag === '#comment' || DROP_TAGS.has(child.tag)) continue
      if (child.tag === 'h1' || child.tag === 'h2' || child.tag === 'h3') {
        flush()
        const text = tidyInline(elementText(child)).trim()
        if (text) out.push(`${'#'.repeat(Number(child.tag[1])) === '#' ? '##' : '###'} ${text}`)
        continue
      }
      walk(child)
      if (isBlockTag(child.tag)) flush()
    }
  }
  walk(node)
  flush()
  return out.join('\n\n')
}
/**
 * Last-resort extraction: pull the <article> block straight out of the raw HTML.
 * Used when the tree parser loses the body (unbalanced markup, exotic nesting).
 */
function rawArticleText(html) {
  const match = /<article\b[^>]*>([\s\S]*?)<\/article>/i.exec(html)
  if (!match) return ''
  return match[1]
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h[1-6]|li|blockquote)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .split('\n')
    .map(line => line.replace(/[ \t]+/g, ' ').trim())
    .filter(Boolean)
    .join('\n\n')
}
function resolveUrl(src, base) {
  if (!src || /^(data|javascript|mailto|tel):/i.test(src)) return ''
  if (/^(https?:)?\/\//i.test(src)) return src.startsWith('//') ? `https:${src}` : src
  if (!base) return src
  try {
    return new URL(src, base).href
  } catch {
    return src
  }
}

function tidyInline(text) {
  return text
    .replace(/[ \t]+/g, ' ')
    .replace(/\s+([，。！？；：、,.!?;:)])/g, '$1')
    .replace(/([(（])\s+/g, '$1')
    .trim()
}

function renderInline(node, ctx) {
  if (node.tag === '#text') {
    const text = decodeEntities(node.text)
      .replace(/[\u00a0\u2000-\u200a\u202f\u205f\u3000]/g, ' ')
      .replace(/\s+/g, ' ')
    return text
  }
  if (DROP_TAGS.has(node.tag)) return ''
  const attrs = node.attrs || {}
  const inner = () => tidyInline(node.children.map(child => renderInline(child, ctx)).join(''))

  switch (node.tag) {
    case 'br': return ' '
    case 'strong': case 'b': {
      const text = inner()
      return text ? `**${text.replace(/\*\*/g, '')}**` : ''
    }
    case 'em': case 'i': {
      const text = inner()
      return text ? `*${text.replace(/\*/g, '')}*` : ''
    }
    case 'del': case 's': case 'strike': {
      const text = inner()
      return text ? `~~${text}~~` : ''
    }
    case 'code': {
      const text = inner()
      if (!text) return ''
      return text.includes('`') ? text : `\`${text}\``
    }
    case 'a': {
      const text = inner()
      const href = resolveUrl(attrs.href, ctx.baseUrl)
      if (!text) return ''
      if (!href || href.startsWith('#')) return text
      return `[${text}](${href})`
    }
    case 'img': {
      const src = resolveUrl(attrs['data-src'] || attrs['data-original'] || attrs.src, ctx.baseUrl)
      const alt = cleanText(attrs.alt || '')
      if (!src || /^data:/.test(src)) return ''
      return `![${alt}](${src})`
    }
    case 'sup': case 'sub': return ''
    default:
      return inner()
  }
}

function inlineOf(node, ctx) {
  return tidyInline((node.children || []).map(child => renderInline(child, ctx)).join(''))
}

function renderList(node, ctx, depth, ordered) {
  const lines = []
  let index = 0
  for (const child of node.children) {
    if (child.tag !== 'li') continue
    index += 1
    const marker = ordered ? `${index}.` : '-'
    const indent = '  '.repeat(depth)
    const inlineParts = []
    const nested = []
    for (const grand of child.children) {
      if (grand.tag === 'ul' || grand.tag === 'ol') {
        nested.push(renderList(grand, ctx, depth + 1, grand.tag === 'ol'))
        continue
      }
      if (grand.tag === '#text') {
        inlineParts.push(renderInline(grand, ctx))
        continue
      }
      if (isBlockTag(grand.tag)) {
        if (grand.tag === 'p' || grand.tag === 'div') inlineParts.push(inlineOf(grand, ctx))
        else inlineParts.push(renderBlock(grand, ctx))
        continue
      }
      inlineParts.push(renderInline(grand, ctx))
    }
    const text = tidyInline(inlineParts.filter(Boolean).join(' ').replace(/\n+/g, ' '))
    if (text) lines.push(`${indent}${marker} ${text}`)
    for (const block of nested) {
      const body = Array.isArray(block) ? block.join('\n') : String(block)
      if (body.trim()) lines.push(body.replace(/^/gm, indent))
    }
  }
  return lines
}

function renderTable(node, ctx) {
  const rows = []
  for (const tr of collect(node, new Set(['tr']))) {
    const cells = tr.children.filter(child => child.tag === 'td' || child.tag === 'th')
    if (cells.length === 0) continue
    rows.push(cells.map(cell => inlineOf(cell, ctx).replace(/\|/g, '\\|').replace(/\n/g, ' ')))
  }
  if (rows.length === 0) return ''
  const width = Math.max(...rows.map(row => row.length))
  const padded = rows.map(row => (row.length < width ? [...row, ...Array(width - row.length).fill('')] : row))
  if (width === 1) return padded.map(row => row[0]).filter(Boolean).join('\n')
  const header = padded[0]
  const divider = header.map(() => '---')
  return [header, divider, ...padded.slice(1)]
    .map(row => `| ${row.join(' | ')} |`)
    .join('\n')
}

function renderBlock(node, ctx) {
  if (node.tag === '#text') return cleanText(node.text)
  if (DROP_TAGS.has(node.tag)) return ''
  if (isBlockTag(node.tag) === false) return inlineOf(node, ctx)

  switch (node.tag) {
    case 'h1': case 'h2': case 'h3': case 'h4': case 'h5': case 'h6': {
      const text = inlineOf(node, ctx)
      if (!text) return ''
      const level = node.tag === 'h1' ? 2 : Number(node.tag[1])
      return `${'#'.repeat(Math.min(6, level))} ${text}`
    }
    case 'hr': return '---'
    case 'pre': {
      const code = findFirst(node, new Set(['code'])) || node
      const raw = elementText(code).replace(/^\n+|\n+$/g, '')
      if (!raw.trim()) return ''
      const classes = `${(code.attrs && code.attrs.class) || ''} ${(node.attrs && node.attrs.class) || ''}`
      const lang = (/(?:language|lang)-([a-z0-9+#]+)/i.exec(classes) || [])[1] || ''
      const fence = raw.includes('```') ? '````' : '```'
      return `${fence}${lang}\n${raw}\n${fence}`
    }
    case 'blockquote': {
      const body = renderChildren(node, ctx)
      if (!body) return ''
      return body.split('\n').map(line => (line ? `> ${line}` : '>')).join('\n')
    }
    case 'ul': return renderList(node, ctx, 0, false).join('\n')
    case 'ol': return renderList(node, ctx, 0, true).join('\n')
    case 'table': return renderTable(node, ctx)
    case 'figure': {
      const parts = []
      for (const child of node.children) {
        if (child.tag === 'img') {
          const src = resolveUrl(child.attrs['data-src'] || child.attrs.src, ctx.baseUrl)
          const alt = cleanText(child.attrs.alt || '')
          if (src && !/^data:/.test(src)) parts.push(`![${alt}](${src})`)
        } else if (child.tag === 'figcaption') {
          const caption = inlineOf(child, ctx)
          if (caption) parts.push(`*${caption}*`)
        } else {
          const body = renderBlock(child, ctx)
          if (body) parts.push(body)
        }
      }
      return parts.join('\n\n')
    }
    case 'img': {
      const src = resolveUrl(node.attrs['data-src'] || node.attrs.src, ctx.baseUrl)
      const alt = cleanText(node.attrs.alt || '')
      if (!src || /^data:/.test(src)) return ''
      return `![${alt}](${src})`
    }
    case 'p': {
      const text = inlineOf(node, ctx)
      return text
    }
    default:
      return renderChildren(node, ctx)
  }
}

function renderChildren(node, ctx) {
  const blocks = []
  let run = []
  const flush = () => {
    const text = tidyInline(run.join(' '))
    if (text) blocks.push(text)
    run = []
  }
  for (const child of node.children) {
    if (child.tag === '#text') {
      const text = cleanText(child.text)
      if (text) run.push(text)
      continue
    }
    if (isBlockTag(child.tag) || (child.blocks || 0) > 0) {
      flush()
      // A span/div wrapper that contains real prose blocks must be rendered as
      // a container; inlining it would glue whole paragraphs into one line.
      const block = isBlockTag(child.tag) ? renderBlock(child, ctx) : renderChildren(child, ctx)
      if (block && String(block).trim()) blocks.push(String(block).trim())
      continue
    }
    const inline = renderInline(child, ctx)
    if (inline) run.push(inline)
  }
  flush()
  return blocks.join('\n\n')
}

function tidyMarkdown(markdown) {
  const seen = new Set()
  const lines = []
  for (const raw of markdown.split('\n')) {
    const line = raw.replace(/[ \t]+$/g, '')
    const trimmed = line.trim()
    if (!trimmed) {
      if (lines.length > 0 && lines[lines.length - 1] !== '') lines.push('')
      continue
    }
    if (seen.has(trimmed)) continue
    seen.add(trimmed)
    lines.push(line.replace(/[ \t]{2,}/g, ' '))
  }
  let text = lines.join('\n').replace(/\n{3,}/g, '\n\n').trim()
  const kept = text.split('\n').filter(line => !CHROME_LINE.test(line.trim()))
  text = kept.join('\n').replace(/\n{3,}/g, '\n\n').trim()
  return text
}

// A trailing reference / "external links" block inflates the token count
// without adding argument. Cut it when it starts late enough to be a tail.
const TAIL_HEADING = /^#{1,4}\s*(references|citations|bibliography|external links|see also|further reading|notes|sources|参考文献|参考资料|延伸阅读|外部链接|参见|注释|引用)\s*$/i

/** Drop the byline / pager / category strip that pages put above the body. */
function trimLeadingFurniture(markdown) {
  const lines = markdown.split('\n')
  let index = 0
  while (index < lines.length && index < 30) {
    const line = lines[index].trim()
    if (line === '') {
      index += 1
      continue
    }
    const linkish = /^[-*]?\s*(\[[^\]]*\]\([^)]*\)|上一篇|下一篇|分类|标签|目录|⇐|⇒)/.test(line)
    const byline = /^(作者|文|撰文|日期|发布时间|来源|编辑|责任编辑)\s*[：:]/.test(line)
    const label = /^(分类|标签|目录|导航|作者|日期|发布|来源|编辑)\s*[：:]?$/.test(line)
    if (!linkish && !byline && !label) break
    index += 1
  }
  return lines.slice(index).join('\n').trim()
}

function cutTrailingBackMatter(markdown) {
  const lines = markdown.split('\n')
  const minimum = Math.floor(markdown.length * 0.35)
  for (let index = 0, cursor = 0; index < lines.length; index++) {
    const line = lines[index]
    if (TAIL_HEADING.test(line.trim()) && cursor > minimum) {
      return lines.slice(0, index).join('\n').trim()
    }
    cursor += line.length + 1
  }
  return markdown
}

function collectMeta(html) {
  const meta = {}
  const re = /<meta\b([^>]*)>/gi
  let match
  while ((match = re.exec(html)) !== null) {
    const attrs = parseAttributes(match[1])
    const key = (attrs.property || attrs.name || attrs.itemprop || '').toLowerCase()
    const content = attrs.content
    if (!key || content === undefined) continue
    if (!(key in meta)) meta[key] = cleanText(content)
  }
  return meta
}

function collectJsonLd(html) {
  const nodes = []
  const re = /<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  let match
  while ((match = re.exec(html)) !== null) {
    const body = match[1].replace(/^\s*<!\[CDATA\[|\]\]>\s*$/g, '').trim()
    if (!body) continue
    try {
      nodes.push(JSON.parse(body))
    } catch {
      // A broken block is not worth failing the whole article over.
    }
  }
  return nodes
}

function* walkJsonLd(value) {
  if (!value || typeof value !== 'object') return
  if (Array.isArray(value)) {
    for (const item of value) yield* walkJsonLd(item)
    return
  }
  yield value
  for (const key of ['@graph', 'mainEntity', 'hasPart', 'itemListElement']) {
    if (value[key]) yield* walkJsonLd(value[key])
  }
}

function jsonLdFacts(html) {
  const facts = { title: '', author: '', published: '', site: '', articleBody: '' }
  for (const root of collectJsonLd(html)) {
    for (const node of walkJsonLd(root)) {
      const types = [].concat(node['@type'] || []).map(String)
      const isArticle = types.some(type => /article|blogposting|newsarticle|posting|report/i.test(type))
      if (!isArticle) continue
      if (!facts.title && typeof node.headline === 'string') facts.title = cleanText(node.headline)
      if (!facts.published && typeof node.datePublished === 'string') facts.published = node.datePublished.slice(0, 10)
      if (!facts.site && node.publisher && typeof node.publisher.name === 'string') facts.site = cleanText(node.publisher.name)
      if (!facts.author && node.author) {
        const authors = [].concat(node.author)
        facts.author = authors.map(author => (typeof author === 'string' ? author : author && author.name)).filter(Boolean).map(cleanText).join('、')
      }
      if (typeof node.articleBody === 'string' && node.articleBody.length > facts.articleBody.length) {
        facts.articleBody = node.articleBody
      }
      if (!facts.fallbackTitle && typeof node.name === 'string') facts.fallbackTitle = cleanText(node.name)
    }
  }
  return facts
}

function stripSiteSuffix(title) {
  if (!title) return ''
  const trimmed = title.trim()
  const parts = trimmed.split(/\s+[|\-–—_·»]\s+/)
  if (parts.length > 1) {
    const first = parts[0].trim()
    if (first.length >= 6) return first
  }
  return trimmed
}

function countWords(text) {
  const cjk = (text.match(/[\u3400-\u9fff\uf900-\ufaff\u3040-\u30ff\uac00-\ud7af]/g) || []).length
  const latin = (text.match(/[A-Za-z0-9][A-Za-z0-9'’._-]*/g) || []).length
  return { cjk, latin, total: cjk + latin }
}

function readingMinutes(cjk, latin) {
  return Math.max(1, Math.round(cjk / 400 + latin / 220))
}

const PAYWALL_HINT = /(订阅后|付费阅读|开通会员|登录后阅读|本文为付费|remaining article|subscribe to continue|sign in to continue)/i

const CHALLENGE_HINT = /(安全检测|环境异常|人机验证|访问验证|滑动验证|just a moment|attention required|checking your browser|cf-challenge|access denied|are you a robot|captcha)/i

/**
 * Extract one article from raw HTML.
 *
 * @param {string} html raw response body.
 * @param {string} url the requested URL, used to resolve relative links.
 * @returns {{ title: string, author: string, site: string, published: string,
 *   description: string, markdown: string, outline: string[], words: number,
 *   cjk: number, latin: number, readingMinutes: number, notices: string[] }}
 */
export function extractArticle(html, url) {
  const notices = []
  const meta = collectMeta(html)
  const facts = jsonLdFacts(html)

  const withoutScripts = html
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript\b[\s\S]*?<\/noscript>/gi, ' ')

  const root = buildTree(withoutScripts)
  measure(root)
  prune(root)

  const host = (() => {
    try {
      return new URL(url).hostname.replace(/^www\./, '')
    } catch {
      return ''
    }
  })()

  let title = cleanText(
    meta['og:title'] || meta['twitter:title'] || facts.title
    || stripSiteSuffix(cleanText(meta['title'] || ''))
    || facts.fallbackTitle
    || (() => {
      const h1 = findFirst(root, new Set(['h1']))
      return h1 ? cleanText(elementText(h1)) : ''
    })(),
  )

  let author = cleanText(meta.author || meta['article:author'] || facts.author || '')
  if (/^\d+$/.test(author)) author = ''
  const site = cleanText(meta['og:site_name'] || facts.site || host)
  let published = cleanText(
    (meta['article:published_time'] || meta['pubdate'] || meta['publishdate'] || facts.published || '').slice(0, 10),
  )
  const description = cleanText(meta['og:description'] || meta.description || '')

  // "标题 - 站点名" is a footer of the <title>, not part of the headline.
  if (site || host) {
    const suffix = /^(.*?)\s+[|·—–-]\s+([^|·—–-]{2,24})$/.exec(title)
    if (suffix) {
      const tail = suffix[2].toLowerCase()
      const siteLower = site.toLowerCase()
      const matches = siteLower.includes(tail) || tail.includes(host.split('.')[0].toLowerCase()) || host.toLowerCase().includes(tail)
      if (matches && suffix[1].trim().length >= 6) title = suffix[1].trim()
    }
  }

  const content = pickContent(root)
  const ctx = { baseUrl: url }
  let markdown = tidyMarkdown(renderChildren(content, ctx))

  // Some pages keep the whole post as bare text split by <br>; the structured
  // pass finds no paragraphs there and returns nothing.
  if (markdown.replace(/\s+/g, '').length < 120) {
    const loose = tidyMarkdown(renderLooseText(content, ctx))
    if (loose.replace(/\s+/g, '').length > markdown.replace(/\s+/g, '').length) markdown = loose
  }

  // Some pages hand the parser markup it cannot keep balanced; the raw block
  // still carries the text, so fall back to it rather than returning nothing.
  if (markdown.replace(/\s+/g, '').length < 120) {
    // run against the original html: a script that wraps the article would
    // already have swallowed it in withoutScripts
    const raw = tidyMarkdown(rawArticleText(html))
    if (raw.replace(/\s+/g, '').length > markdown.replace(/\s+/g, '').length) {
      markdown = raw
      notices.push('正文取自页面里的 article 区块（结构化解析降级）。')
    }
  }

  // A structured-data articleBody is sometimes the only clean copy (or the
  // whole copy behind a client-rendered shell). Prefer it when it is richer.
  if (facts.articleBody) {
    const body = facts.articleBody
      .split(/\n{1,}/)
      .map(line => line.trim())
      .filter(Boolean)
      .join('\n\n')
    if (body.length > markdown.length * 1.2) {
      markdown = tidyMarkdown(body)
      notices.push('正文取自页面的结构化数据（JSON-LD articleBody）。')
    }
  }

  if (content !== root && title) {
    // Remove the headline echo: the title is returned separately. Scan the top
    // of the body because a nav strip may sit above it.
    const lines = markdown.split('\n')
    const scanTo = Math.min(lines.length, 20)
    for (let index = 0; index < scanTo; index += 1) {
      const match = /^#{1,3}\s+(.+)$/.exec(lines[index].trim())
      if (!match) continue
      const heading = cleanText(match[1])
      if (heading.length < 6) continue
      const same = heading === title
        || (heading.length >= 8 && title.startsWith(heading.slice(0, 14)))
        || (title.length >= 8 && heading.startsWith(title.slice(0, 14)))
      if (!same) continue
      lines.splice(index, 1)
      markdown = lines.join('\n').trim()
      break
    }
  }

  markdown = cutTrailingBackMatter(markdown)
  markdown = trimLeadingFurniture(markdown)

  // Sites without meta tags usually print "作者：X" and a date near the top.
  // Read them from the article's own text, before the byline is trimmed below.
  if (!author || !published) {
    const headText = cleanText(elementText(content)).slice(0, 700)
    if (!author) {
      const match = /(?:作者|撰文|文)\s*[:：/]\s*([^\s，。,|｜]{2,30})/.exec(headText)
      if (match) author = cleanText(match[1]).replace(/^[-–—\s]+/, '')
    }
    if (!published) {
      const cjkDate = /(20\d{2})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/.exec(headText)
      const isoDate = /(20\d{2})-(\d{1,2})-(\d{1,2})/.exec(headText)
      const match = cjkDate || isoDate
      if (match) published = `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`
    }
  }

  // Drop a leading byline block that only repeats the returned metadata.
  markdown = markdown.replace(/^(?:(?:作者|文|撰文|日期|发布时间|来源|编辑|责任编辑)\s*[:：][^\n]*\n+){1,4}/, '').trim()

  // Nothing usable came out of the tree (navigation scraps that later trim
  // away): the raw article block is usually still there and much longer.
  if (markdown.replace(/\s+/g, '').length < 200) {
    const raw = trimLeadingFurniture(cutTrailingBackMatter(tidyMarkdown(rawArticleText(html))))
    if (raw.replace(/\s+/g, '').length > markdown.replace(/\s+/g, '').length) {
      markdown = raw
      notices.push('正文取自页面里的 article 区块（结构化解析降级）。')
    }
  }

  // A status-style page often carries no usable <title>; the first line of the
  // body is the headline the author wrote.
  if (!title) {
    const lines = markdown.split('\n').map(line => line.trim())
      .filter(line => line.replace(/[\s#>*`]/g, '').length > 3)
    // skip a leading \$TICKER\$ tag line: it names the stock, not the piece
    const firstLine = lines.find(line => !/^\$[^$]{1,24}\$/.test(line.replace(/[*_`#]/g, ''))) || lines[0]
    if (firstLine) {
      title = cleanText(firstLine
        .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
        .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
        .replace(/[*_`#>]/g, ''))
        .slice(0, 40)
    }
  }

  const challenged = markdown.length < 400 && CHALLENGE_HINT.test(markdown)
  if (challenged) {
    notices.push('页面返回的是人机验证/安全检测页，正文被站点拦截，没有取到真实内容。')
  }
  if (markdown.length < 400) {
    notices.push('正文很短（可能被登录墙、付费墙或前端渲染挡住），请结合页面其他信息判断。')
    if (PAYWALL_HINT.test(html)) notices.push('页面里出现订阅/登录提示，正文大概率不完整。')
  }

  const words = countWords(markdown)

  // Outline: markdown headings in document order, capped.
  const outline = []
  for (const line of markdown.split('\n')) {
    const match = /^(#{2,4})\s+(.+)$/.exec(line.trim())
    if (!match) continue
    if (match[2].length > 60) continue
    outline.push(`${match[1].length > 2 ? '  · ' : ''}${match[2]}`)
    if (outline.length >= 24) break
  }

  return {
    title,
    author,
    site,
    published,
    description,
    markdown,
    outline,
    words: words.total,
    cjk: words.cjk,
    latin: words.latin,
    readingMinutes: readingMinutes(words.cjk, words.latin),
    notices,
    challenged,
  }
}

/** Convert plain text (already Markdown-ish) into the same shape as an article. */
export function extractFromText(text, url) {
  const markdown = tidyMarkdown(String(text || ''))
  const words = countWords(markdown)
  const firstLine = markdown.split('\n').find(line => line.trim()) || ''
  return {
    title: cleanText(firstLine.replace(/^#{1,6}\s+/, '')).slice(0, 160),
    author: '',
    site: (() => {
      try {
        return new URL(url).hostname.replace(/^www\./, '')
      } catch {
        return ''
      }
    })(),
    published: '',
    description: '',
    markdown,
    outline: [],
    words: words.total,
    cjk: words.cjk,
    latin: words.latin,
    readingMinutes: readingMinutes(words.cjk, words.latin),
    notices: ['该地址返回的是纯文本，未做 HTML 正文抽取。'],
    challenged: false,
  }
}

