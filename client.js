// page-between (页间) — Client half.
//
// 页间：贴链接 → 直接出解读（结论 / 要点 / 分段 / 评论 / 导图），
// 框选正文任意一句就能收成便签，便签停在首页。

window.__ModuleLoader__.load({
  id: 'dsh-page-between',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const { useState, useEffect, useCallback, useRef } = React

    const STORE_KEY = 'article-desk.notes.v2'
    const FONT_SERIF = '"Songti SC","Noto Serif SC","Source Han Serif SC","SimSun",Georgia,serif'
    const FONT_SANS = '"PingFang SC","Microsoft YaHei UI","Microsoft YaHei","Segoe UI",sans-serif'

    // Colours resolve through CSS variables so the page follows the host theme.
    const V = {
      bg: 'var(--adg-bg)',
      card: 'var(--adg-card)',
      cardHi: 'var(--adg-card-hi)',
      border: 'var(--adg-border)',
      text: 'var(--adg-text)',
      muted: 'var(--adg-muted)',
      faint: 'var(--adg-faint)',
      body: 'var(--adg-body)',
      surface: 'var(--adg-surface)',
      ink: 'var(--adg-ink)',
      action: 'var(--adg-action)',
      actionInk: 'var(--adg-action-ink)',
      glow: 'var(--adg-glow)',
      dock: 'var(--adg-dock)',
      sage: 'var(--adg-a1)',
      blue: 'var(--adg-a2)',
      rose: 'var(--adg-a3)',
      sand: 'var(--adg-a4)',
      mauve: 'var(--adg-a5)',
      paper: '#f6f1e7',
      paperInk: '#3a3730',
      paperMuted: '#6f685c',
    }
    const ACCENTS = [V.sage, V.blue, V.rose, V.sand, V.mauve]

    const THEME_CSS = `
      @media (max-width: 980px) { .adk-history { display: none; } }
      .adg-dark{
        --adg-bg:#14151a; --adg-text:#e9e4db; --adg-muted:rgba(233,228,219,0.52);
        --adg-faint:rgba(233,228,219,0.30); --adg-body:rgba(233,228,219,0.80);
        --adg-card:rgba(233,228,219,0.045); --adg-card-hi:rgba(233,228,219,0.075);
        --adg-border:rgba(233,228,219,0.13); --adg-surface:rgba(20,21,26,0.94);
        --adg-action:#46584c; --adg-action-ink:#f2eee6; --adg-ink:#f4f0e7;
        --adg-a1:#a9bba6; --adg-a2:#9fb0c4; --adg-a3:#c9a9a0; --adg-a4:#c6b092; --adg-a5:#b0a3b8;
        --adg-glow:radial-gradient(1100px 520px at 50% -12%, rgba(169,187,166,0.10), transparent 62%), radial-gradient(900px 460px at 82% 8%, rgba(159,176,196,0.07), transparent 60%);
        --adg-dock:linear-gradient(180deg, rgba(20,21,26,0) 0%, rgba(20,21,26,0.90) 30%, rgba(20,21,26,0.99) 100%);
      }
      .adg-light{
        --adg-bg:#f6f2ea; --adg-text:#23211d; --adg-muted:rgba(35,33,29,0.58);
        --adg-faint:rgba(35,33,29,0.36); --adg-body:rgba(35,33,29,0.82);
        --adg-card:rgba(35,33,29,0.045); --adg-card-hi:rgba(35,33,29,0.075);
        --adg-border:rgba(35,33,29,0.13); --adg-surface:rgba(246,242,234,0.95);
        --adg-action:#4d5f52; --adg-action-ink:#f7f2e8; --adg-ink:#000000;
        --adg-a1:#6d7f5c; --adg-a2:#5c7186; --adg-a3:#a2675c; --adg-a4:#96703c; --adg-a5:#6d6183;
        --adg-glow:radial-gradient(1100px 520px at 50% -12%, rgba(109,127,92,0.10), transparent 62%), radial-gradient(900px 460px at 82% 8%, rgba(92,113,134,0.07), transparent 60%);
        --adg-dock:linear-gradient(180deg, rgba(246,242,234,0) 0%, rgba(246,242,234,0.90) 30%, rgba(246,242,234,0.99) 100%);
      }
    `

    const CSS = `
      .adk *{box-sizing:border-box}
      .adk ::selection{background:rgba(169,187,166,0.35)}
      .adk-scroll::-webkit-scrollbar{width:9px;height:9px}
      .adk-scroll::-webkit-scrollbar-thumb{background:rgba(233,228,219,0.18);border-radius:9px}
      .adk-btn{transition:background .18s ease,border-color .18s ease,transform .18s ease}
      .adk-btn:hover{background:rgba(233,228,219,0.1)!important}
      .adk-card{transition:border-color .2s ease,transform .2s ease,background .2s ease}
      .adk-card:hover{transform:translateY(-2px);border-color:rgba(233,228,219,0.26)!important;background:rgba(233,228,219,0.07)!important}
      .adk-polaroid{cursor:grab}
      @keyframes adk-tape-in{0%{opacity:0;transform:translateX(-50%) translateY(-18px) rotate(-16deg) scaleY(1.7) scaleX(0.86)}55%{opacity:1;transform:translateX(-50%) translateY(3px) rotate(-2deg) scaleY(0.9) scaleX(1.04)}100%{opacity:1;transform:translateX(-50%) translateY(0) rotate(-3.5deg) scaleY(1) scaleX(1)}}
      .adk-landed .adk-tape{animation:adk-tape-in .58s cubic-bezier(.2,.85,.25,1) both}
      @keyframes adk-press{0%{box-shadow:0 22px 48px rgba(0,0,0,0.5)}45%{box-shadow:0 6px 14px rgba(0,0,0,0.28)}100%{box-shadow:0 12px 26px rgba(0,0,0,0.38)}}
      .adk-landed{animation:adk-press .58s ease both}
      .adk-polaroid:active{cursor:grabbing}
      .adk-polaroid:hover{box-shadow:0 20px 42px rgba(0,0,0,0.45)}
      .adk-chip{transition:background .16s ease,border-color .16s ease,color .16s ease}
      .adk-chip:hover{background:rgba(169,187,166,0.22)!important;border-color:rgba(169,187,166,0.6)!important;color:#eaf1e6!important}
      @keyframes adk-fade{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
      .adk-fade{animation:adk-fade .25s ease both}
      @keyframes adk-fadeIn { from { opacity: 0 } to { opacity: 1 } }
      @keyframes adk-pageIn { from { opacity: 0; transform: rotateY(-9deg) translateX(-12px) } to { opacity: 1; transform: none } }
      @keyframes adk-pageOpen {
        0% { transform: rotateY(-88deg) }
        55% { transform: rotateY(-6deg) }
        75% { transform: rotateY(-14deg) }
        100% { transform: rotateY(0deg) }
      }
      @keyframes adk-pageGlow { 0%,100% { opacity: .18 } 50% { opacity: .38 } }
      @keyframes adk-foldUp {
        from { opacity: 1; clip-path: inset(0 0 0 0) }
        to { opacity: 0; clip-path: inset(0 0 100% 0) }
      }
      @keyframes adk-unfold {
        from { opacity: 0; clip-path: inset(0 0 100% 0); transform: translateY(-6px) }
        to { opacity: 1; clip-path: inset(0 0 0 0); transform: none }
      }
      @keyframes adk-spin{to{transform:rotate(360deg)}}
      .adk-dot{animation:adk-spin 1s linear infinite}
    `

    /** Read the host theme; fall back to the OS preference. */
    function colorIsLight(value) {
      const match = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(value || '')
      if (match === null) return null
      const luma = 0.2126 * Number(match[1]) + 0.7152 * Number(match[2]) + 0.0722 * Number(match[3])
      return luma > 140
    }

    function detectLight(theme) {
      // 1) whatever the host theme service reports, in any shape it reports it
      try {
        const snapshot = theme !== undefined && theme !== null && typeof theme.getTheme === 'function'
          ? theme.getTheme()
          : undefined
        const text = JSON.stringify(snapshot ?? '')
        if (/light|day|white|paper|snow|cream/i.test(text)) return true
        if (/dark|night|black|ink|dim/i.test(text)) return false
      } catch {
        // keep looking
      }
      // 2) theme markers present in the page itself
      try {
        const root = document.documentElement
        const marker = [
          root.className, root.getAttribute('data-theme') || '',
          root.getAttribute('data-color-scheme') || '',
          document.body ? document.body.className : '',
        ].join(' ').toLowerCase()
        if (/light|day|white|paper/.test(marker)) return true
        if (/dark|night|black|ink/.test(marker)) return false
      } catch {
        // keep looking
      }
      // 3) the actual painted background of the app shell
      try {
        const painted = colorIsLight(getComputedStyle(document.body).backgroundColor)
        if (painted !== null) return painted
      } catch {
        // keep looking
      }
      // 4) last resort: the OS preference
      try {
        return !window.matchMedia('(prefers-color-scheme: dark)').matches
      } catch {
        return false
      }
    }

    const POS_KEY = 'article-desk.positions.v1'
    const DOCK_RESERVE = 104
    const NOTE_FONT = 13.2
    const NOTE_PAPERS = ['#f8f3e9', '#eef1e6', '#e8eef3', '#f4eae5', '#f7efe1', '#efeaf2', '#f1f3ea']
    const LANGS = [
      { id: 'zh', label: '简' },
      { id: 'zh-Hant', label: '繁' },
      { id: 'en', label: 'EN' },
    ]
    const UI = {
      zh: { points: '要点', sections: '逐段精读', commentary: '读后评论', show: '查看原文 ↓', hide: '收起原文 ↑', export: '导出到 Notion', notion: '打开 Notion ↗', ask: '就这篇继续问…', labels: ['说服我的地方', '我存疑的地方', '换个坐标系', '可以怎么用'], note: '批注', map: '结构导图', mapHint: '点击放大 · 滚轮缩放', history: '最近看过', historyEmpty: '读过的文章会出现在这里' },
      'zh-Hant': { points: '重點', sections: '逐段精讀', commentary: '讀後評論', show: '查看原文 ↓', hide: '收起原文 ↑', export: '匯出到 Notion', notion: '開啟 Notion ↗', ask: '就這篇繼續問…', labels: ['說服我的地方', '我存疑的地方', '換個座標系', '可以怎麼用'], note: '批註', map: '結構導圖', mapHint: '點擊放大 · 滾輪縮放', history: '最近看過', historyEmpty: '讀過的文章會出現在這裡' },
      en: { points: 'Key points', sections: 'Section by section', commentary: 'My take', show: 'Show original ↓', hide: 'Hide original ↑', export: 'Export to Notion', notion: 'Open Notion ↗', ask: 'Ask about this piece…', labels: ['What convinced me', 'Where I doubt it', 'Another frame', 'How to use it'], note: 'Note', map: 'Mind map', mapHint: 'Click to zoom · scroll to scale', history: 'Recently read', historyEmpty: 'Articles you read show up here' },
    }
    const GUIDE_KEY = 'article-desk.guide.v1'
    const GUIDE_HIDDEN_KEY = 'article-desk.guideHidden.v1'
    const FRESH_KEY = 'article-desk.freshStart'
    const FRESH_VERSION = 'v1'
    const HISTORY_KEY = 'article-desk.history.v1'
    const HISTORY_MAX = 10

    function readHistory() {
      try {
        const raw = window.localStorage.getItem(HISTORY_KEY)
        const list = raw ? JSON.parse(raw) : []
        return Array.isArray(list) ? list.filter(item => item && item.url) : []
      } catch {
        return []
      }
    }

    function writeHistory(list) {
      try {
        window.localStorage.setItem(HISTORY_KEY, JSON.stringify(list.slice(0, HISTORY_MAX)))
      } catch {
        // ignore quota problems
      }
    }
    const LAST_KEY = 'article-desk.last.v1'
    const LAST_CHAT_KEY = 'article-desk.lastChat.v1'
    const GUIDE_DEFAULT = '使用指南\n\n1 · 贴上链接，回车：自动读正文、出导图、写解读\n2 · 框选任意一句 →「收进便签」，便签可以拖到任何位置\n3 · 点便签放大，内容可以改；右键 … 这里可以拖动胶带移动\n4 · 底部对谈栏：就这一篇继续追问\n5 · 文末「导出到 Notion」：一键复制成 Notion 格式'

    function readPositions() {
      try {
        const raw = window.localStorage.getItem(POS_KEY)
        const parsed = raw ? JSON.parse(raw) : {}
        return parsed && typeof parsed === 'object' ? parsed : {}
      } catch {
        return {}
      }
    }

    function writePositions(map) {
      try {
        window.localStorage.setItem(POS_KEY, JSON.stringify(map))
      } catch {
        // ignore quota problems: stickers just stay put
      }
    }

    function readNotes() {
      try {
        const raw = window.localStorage.getItem(STORE_KEY)
        const list = raw ? JSON.parse(raw) : []
        return Array.isArray(list) ? list : []
      } catch {
        return []
      }
    }

    function writeNotes(list) {
      try {
        window.localStorage.setItem(STORE_KEY, JSON.stringify(list))
      } catch {
        // storage blocked: keep the shelf in memory only
      }
    }

    async function fetchWithRetry(url, options) {
      const call = () => fetch(url, options)
      try {
        const first = await call()
        if (first.status !== 404 && first.status !== 502 && first.status !== 503) return first
        // the host may still be mounting the plugin after a reload: try once more
        await new Promise(resolve => setTimeout(resolve, 700))
        return await call()
      } catch (error) {
        await new Promise(resolve => setTimeout(resolve, 700))
        return await call()
      }
    }

    async function requestAnalysis(url, lang = 'zh') {
      const response = await fetchWithRetry(`/article-desk/analyze?url=${encodeURIComponent(url)}&lang=${encodeURIComponent(lang)}`)
      let data
      try {
        data = await response.json()
      } catch {
        throw new Error(`服务没有返回结果（HTTP ${response.status}）`)
      }
      if (!response.ok || !data.ok) throw new Error(data.error || '抓取或解析失败')
      return data
    }

    async function requestOpen(url) {
      try {
        const response = await fetchWithRetry(`/article-desk/open?url=${encodeURIComponent(url)}`)
        const data = await response.json()
        return response.ok && data.ok ? data : null
      } catch {
        return null
      }
    }

    const EMPTY_ANALYSIS = Object.freeze({
      oneLiner: '', points: [], sections: [],
      commentary: { persuaded: '', doubts: '', frame: '', use: '' },
    })

    function shortDate(value) {
      const date = new Date(value)
      if (Number.isNaN(date.getTime())) return ''
      return `${date.getMonth() + 1}月${date.getDate()}日`
    }

    /** Render **bold** runs without a markdown dependency; bold carries the accent. */
    /** Minimal Markdown renderer for the original-text view: images, links, emphasis, lists. */
    function renderMarkdown(markdown, palette) {
      const inline = (text, keyBase) => {
        const nodes = []
        const pattern = /!\[([^\]]*)\]\(([^)\s]+)[^)]*\)|\[([^\]]+)\]\(([^)\s]+)[^)]*\)|\*\*([^*]+)\*\*|`([^`]+)`/g
        let index = 0
        let match
        let counter = 0
        while ((match = pattern.exec(text)) !== null) {
          if (match.index > index) nodes.push(text.slice(index, match.index))
          counter += 1
          const key = `${keyBase}-i${counter}`
          if (match[1] !== undefined) {
            nodes.push(imageNode(match[2], match[1], key, palette))
          } else if (match[3] !== undefined) {
            nodes.push(h('a', {
              key, href: match[4], target: '_blank', rel: 'noreferrer',
              style: { color: palette.blue, textDecoration: 'underline', textUnderlineOffset: 3 },
            }, match[3]))
          } else if (match[5] !== undefined) {
            nodes.push(h('strong', { key, style: { fontWeight: 700, color: palette.text } }, match[5]))
          } else {
            nodes.push(h('code', { key, style: { fontSize: '0.92em', padding: '1px 4px', borderRadius: 4, background: palette.card } }, match[6]))
          }
          index = match.index + match[0].length
        }
        if (index < text.length) nodes.push(text.slice(index))
        return nodes.length > 0 ? nodes : text
      }

      const imageNode = (src, alt, key, palette) => h('img', {
        key, src, alt: alt || '', loading: 'lazy',
        style: {
          display: 'block', maxWidth: '100%', height: 'auto',
          margin: '14px 0', borderRadius: 10, background: palette.card,
          boxShadow: '0 6px 18px rgba(0,0,0,0.12)',
        },
      })

      const blocks = []
      const lines = String(markdown || '').split('\n')
      let paragraph = []
      let list = null
      let counter = 0
      const flushParagraph = () => {
        if (paragraph.length === 0) return
        counter += 1
        blocks.push(h('p', {
          key: `p${counter}`,
          style: { margin: '0 0 14px' },
        }, inline(paragraph.join(' '), `p${counter}`)))
        paragraph = []
      }
      const flushList = () => {
        if (list === null) return
        blocks.push(list)
        list = null
      }

      for (const raw of lines) {
        const line = raw.trimEnd()
        if (line.trim() === '') { flushParagraph(); flushList(); continue }
        const heading = /^(#{1,4})\s+(.*)$/.exec(line)
        if (heading !== null) {
          flushParagraph(); flushList(); counter += 1
          const level = heading[1].length
          blocks.push(h('div', {
            key: `h${counter}`,
            style: {
              margin: level <= 2 ? '28px 0 12px' : '22px 0 10px',
              fontSize: level <= 2 ? 20 : 17, fontWeight: 700, color: palette.text,
              fontFamily: FONT_SERIF, letterSpacing: '0.02em',
            },
          }, inline(heading[2], `h${counter}`)))
          continue
        }
        if (/^([-*_])\1{2,}$/.test(line.trim())) {
          flushParagraph(); flushList(); counter += 1
          blocks.push(h('div', { key: `hr${counter}`, style: { height: 1, background: palette.border, margin: '22px 0' } }))
          continue
        }
        const quote = /^>\s?(.*)$/.exec(line)
        if (quote !== null) {
          flushParagraph(); flushList(); counter += 1
          blocks.push(h('div', {
            key: `q${counter}`,
            style: { borderLeft: `2px solid ${palette.border}`, paddingLeft: 14, margin: '0 0 14px', color: palette.muted },
          }, inline(quote[1], `q${counter}`)))
          continue
        }
        const item = /^(?:[-*+]\s+|(\d+)[.)]\s+)(.*)$/.exec(line)
        if (item !== null) {
          flushParagraph()
          counter += 1
          if (list === null) {
            list = h('div', { key: `ul${counter}`, style: { margin: '0 0 14px', display: 'flex', flexDirection: 'column', gap: 6 } }, [])
          }
          list.props.children.push(h('div', {
            key: `li${counter}`,
            style: { display: 'flex', gap: 9, alignItems: 'baseline' },
          }, [
            h('span', { key: 'b', style: { color: palette.faint, flexShrink: 0 } }, item[1] !== undefined ? `${item[1]}.` : '·'),
            h('span', { key: 't', style: { flex: 1, minWidth: 0 } }, inline(item[2], `li${counter}`)),
          ]))
          continue
        }
        const loneImage = /^!\[([^\]]*)\]\(([^)\s]+)[^)]*\)$/.exec(line.trim())
        if (loneImage !== null) {
          flushParagraph(); flushList(); counter += 1
          blocks.push(imageNode(loneImage[2], loneImage[1], `img${counter}`, palette))
          continue
        }
        flushList()
        paragraph.push(line.trim())
      }
      flushParagraph()
      flushList()
      return blocks
    }
    function rich(text, accent = '#e7c08a') {
      if (text === null || text === undefined) return ''
      const source = typeof text === 'string' ? text : String(text)
      const nodes = []
      const pattern = /\[([^\]]+)\]\(([^)\s]+)[^)]*\)|\*\*([^*]+)\*\*|`([^`]+)`/g
      let index = 0
      let match
      let counter = 0
      while ((match = pattern.exec(source)) !== null) {
        if (match.index > index) nodes.push(source.slice(index, match.index))
        counter += 1
        const key = `r${match.index}-${counter}`
        if (match[1] !== undefined) {
          nodes.push(h('a', {
            key, href: match[2], target: '_blank', rel: 'noreferrer',
            style: { color: 'var(--adg-a2)', textDecoration: 'underline', textUnderlineOffset: 3 },
          }, match[1]))
        } else if (match[3] !== undefined) {
          nodes.push(h('strong', {
            key, style: { color: accent, fontWeight: 700, letterSpacing: '0.01em' },
          }, rich(match[3], accent)))
        } else {
          nodes.push(h('code', {
            key, style: { fontSize: '0.92em', padding: '1px 4px', borderRadius: 4, background: 'var(--adg-card)' },
          }, match[4]))
        }
        index = match.index + match[0].length
      }
      if (index < source.length) nodes.push(source.slice(index))
      return nodes.length > 0 ? nodes : source
    }

    function fmtTokens(value) {
      const number = Number(value) || 0
      if (number >= 10000) return `${(number / 1000).toFixed(1)}k`
      if (number >= 1000) return `${(number / 1000).toFixed(2)}k`
      return String(number)
    }

    function Icon({ size = 20, active }) {
      // the sidebar sits outside the themed container, so var(--adg-*) is not available here
      const stroke = active ? '#8fa886' : 'currentColor'
      return h('svg', {
        width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
        stroke, strokeWidth: active ? 2 : 1.6, strokeLinecap: 'round', strokeLinejoin: 'round',
        'aria-hidden': true, style: { display: 'block' },
      }, [
        h('path', { key: 'p', d: 'M5.5 4.5h9L18.5 8v11.5h-13z' }),
        h('path', { key: 'l', d: 'M8.5 10h7M8.5 13.5h7M8.5 17h4.5' }),
      ])
    }

    function ZoomOverlay({ src, scale, setScale, onClose }) {
      useEffect(() => {
        const onKey = event => {
          if (event.key === 'Escape') onClose()
          if (event.key === '+' || event.key === '=') setScale(value => Math.min(4, value + 0.2))
          if (event.key === '-') setScale(value => Math.max(0.4, value - 0.2))
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
      }, [setScale, onClose])

      const step = delta => () => setScale(value => Math.min(4, Math.max(0.4, value + delta)))

      return h('div', {
        style: {
          position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(12,13,16,0.94)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        },
        onClick: onClose,
        onWheel: event => {
          event.preventDefault()
          setScale(value => Math.min(4, Math.max(0.4, value + (event.deltaY > 0 ? -0.12 : 0.12))))
        },
      }, [
        h('div', {
          key: 'bar',
          style: {
            position: 'absolute', top: 18, right: 20, display: 'flex', gap: 8,
            alignItems: 'center', color: V.text,
          },
          onClick: event => event.stopPropagation(),
        }, [
          h('button', { key: '-', className: 'adk-btn', onClick: step(-0.2), style: zoomBtn }, '−'),
          h('span', { key: 'v', style: { minWidth: 48, textAlign: 'center', fontSize: 16, color: V.muted } },
            `${Math.round(scale * 100)}%`),
          h('button', { key: '+', className: 'adk-btn', onClick: step(0.2), style: zoomBtn }, '+'),
          h('button', { key: '1', className: 'adk-btn', onClick: () => setScale(1), style: { ...zoomBtn, width: 54 } }, '1:1'),
          h('button', { key: 'x', className: 'adk-btn', onClick: onClose, style: { ...zoomBtn, width: 38 } }, '×'),
        ]),
        h('img', {
          key: 'img', src, alt: '结构导图', draggable: false,
          onClick: event => event.stopPropagation(),
          style: {
            maxWidth: '92vw', maxHeight: '84vh', borderRadius: 12,
            transform: `scale(${scale})`, transition: 'transform .12s ease',
            boxShadow: '0 24px 70px rgba(0,0,0,0.55)',
          },
        }),
        h('div', {
          key: 'hint',
          style: { position: 'absolute', bottom: 20, fontSize: 16, color: V.faint },
        }, '滚轮或 +/− 缩放 · 点击空白处或 Esc 关闭'),
      ])
    }

    const zoomBtn = {
      width: 34, height: 34, borderRadius: 10, border: `1px solid ${V.border}`,
      background: 'rgba(233,228,219,0.06)', color: V.text, fontSize: 16,
      cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    }

    function Desk(props) {
      const theme = props && props.theme
      const [isLight, setIsLight] = useState(() => detectLight(theme))
      const [view, setView] = useState('home')
      const [input, setInput] = useState('')
      const [loading, setLoading] = useState(false)
      const [curtain, setCurtain] = useState(false)
      const [fading, setFading] = useState(false)
      const [folding, setFolding] = useState(false)
      const [error, setError] = useState('')
      const [data, setData] = useState(null)
      const [showText, setShowText] = useState(false)
      const [messages, setMessages] = useState([])
      const [draft, setDraft] = useState('')
      const [asking, setAsking] = useState(false)
      const [chatOpen, setChatOpen] = useState(false)
      const [chatUsage, setChatUsage] = useState({ turns: 0, input: 0, output: 0, total: 0 })
      const [opened, setOpened] = useState(null)
      const [activeDrag, setActiveDrag] = useState(null)
      const [editingGuide, setEditingGuide] = useState(false)
      const [editText, setEditText] = useState('')
      useEffect(() => { setEditText(opened ? opened.quote : '') }, [opened])
      const [positions, setPositions] = useState(() => readPositions())
      const [lang, setLang] = useState('zh')
      const [switching, setSwitching] = useState(false)
      useEffect(() => {
        try {
          if (window.localStorage.getItem(FRESH_KEY) === FRESH_VERSION) return
          const doomed = []
          for (let i = 0; i < window.localStorage.length; i += 1) {
            const key = window.localStorage.key(i)
            if (key && key.startsWith('article-desk.') && key !== FRESH_KEY) doomed.push(key)
          }
          for (const key of doomed) window.localStorage.removeItem(key)
          window.localStorage.setItem(FRESH_KEY, FRESH_VERSION)
          setNotes([])
          setHistory([])
          setPositions({})
          setGuideHidden(false)
          setGuideText(GUIDE_DEFAULT)
          setData(null)
          setView('home')
        } catch {
          // storage unavailable: keep running without a reset
        }
      }, [])

      const [history, setHistory] = useState(() => readHistory())
      const [historyOpen, setHistoryOpen] = useState(false)
      const [guideHidden, setGuideHidden] = useState(() => {
        try { return window.localStorage.getItem(GUIDE_HIDDEN_KEY) === '1' } catch { return false }
      })
      const [guideText, setGuideText] = useState(() => {
        try { return window.localStorage.getItem(GUIDE_KEY) || GUIDE_DEFAULT } catch { return GUIDE_DEFAULT }
      })
      const resizeRef = useRef(null)
      const [landed, setLanded] = useState(null)
      const dragRef = useRef(null)
      const landTimer = useRef(null)
      const inputRef = useRef(null)
      const [notes, setNotes] = useState(() => readNotes())
      const [zoom, setZoom] = useState(0)
      const [toast, setToast] = useState('')
      const [pick, setPick] = useState(null)
      const timerRef = useRef(null)

      const flash = useCallback(message => {
        setToast(message)
        if (timerRef.current) window.clearTimeout(timerRef.current)
        timerRef.current = window.setTimeout(() => setToast(''), 2400)
      }, [])

      useEffect(() => {
        const run = async () => {
          let restored = false
          try {
            const raw = window.localStorage.getItem(LAST_KEY)
            if (raw) {
              const saved = JSON.parse(raw)
              if (saved && saved.data && saved.data.markdown) {
                setData({ ...saved.data, pending: false })
                setLang(saved.lang || 'zh')
                setInput(saved.data.url || '')
                setIsLight(typeof saved.isLight === 'boolean' ? saved.isLight : detectLight(theme))
                setView('article')
                const chatRaw = window.localStorage.getItem(LAST_CHAT_KEY)
                if (chatRaw) {
                  const chat = JSON.parse(chatRaw)
                  if (chat && chat.url === saved.data.url && Array.isArray(chat.messages)) setMessages(chat.messages)
                }
                restored = true
              }
            }
          } catch {
            // fall through to the host-side pointer
          }
          if (restored) return
          // A fresh conversation may start with empty storage: ask the host what was last read.
          try {
            const response = await fetch('/article-desk/session')
            const body = await response.json()
            if (!body || !body.ok) return
            if (body.payload) {
              setData({ ...body.payload, pending: false })
              setLang(body.payload.lang || 'zh')
              setInput(body.payload.url || '')
              setView('article')
              return
            }
            // The digest cache may be gone, but the article itself is cheap to reload.
            if (body.session && body.session.url) {
              const quick = await requestOpen(body.session.url)
              if (quick) {
                setData({ ...quick, analysis: EMPTY_ANALYSIS, pending: false, modelError: '' })
                setLang(body.session.lang || 'zh')
                setInput(quick.url)
                setView('article')
              }
            }
          } catch {
            // nothing to restore
          }
        }
        run()
      }, [])

      useEffect(() => {
        if (!data || data.pending) return
        try {
          window.localStorage.setItem(LAST_KEY, JSON.stringify({ url: data.url, lang, data, at: Date.now() }))
          fetch('/article-desk/session', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ url: data.url, lang }),
          }).catch(() => {})
        } catch {
          // quota: keep the panel working without persistence
        }
      }, [data, lang])

      useEffect(() => {
        if (!data || data.pending || !data.analysis) return
        setHistory(previous => {
          const entry = {
            url: data.url,
            title: data.title || data.url,
            site: data.site || '',
            at: Date.now(),
          }
          const rest = previous.filter(item => item.url !== entry.url)
          const next = [entry, ...rest].slice(0, HISTORY_MAX)
          writeHistory(next)
          return next
        })
      }, [data])

      useEffect(() => {
        if (!data) return
        try {
          window.localStorage.setItem(LAST_CHAT_KEY, JSON.stringify({ url: data.url, messages }))
        } catch {
          // ignore quota problems
        }
      }, [messages, data])

      useEffect(() => () => {
        if (timerRef.current) window.clearTimeout(timerRef.current)
      }, [])

      useEffect(() => {
        if (loading) {
          setCurtain(true)
          setFading(false)
          return undefined
        }
        if (!curtain) return undefined
        setFading(true)
        const fadeTimer = window.setTimeout(() => {
          setCurtain(false)
          setFading(false)
        }, 340)
        return () => window.clearTimeout(fadeTimer)
      }, [loading, curtain])
      useEffect(() => {
        if (theme === undefined) return undefined
        const timer = window.setInterval(() => setIsLight(detectLight(theme)), 1200)
        return () => window.clearInterval(timer)
      }, [theme])

      const open = useCallback(async rawUrl => {
        const url = String(rawUrl || '').trim()
        if (!url) return
        setLoading(true)
        setError('')
        setPick(null)
        try {
          const quick = await requestOpen(url)
          if (quick !== null) {
            setData({ ...quick, analysis: EMPTY_ANALYSIS, pending: true, modelError: '' })
            setInput(quick.url)
            setView('article')
            setZoom(0)
            setShowText(false)
            setMessages([])
            setDraft('')
            setChatOpen(false)
            setChatUsage({ turns: 0, input: 0, output: 0, total: 0 })
            // the page is readable now: drop the curtain and let the digest stream in
            setLoading(false)
          }
          const result = await requestAnalysis(url, lang)
          setData(result)
          setInput(result.url)
        } catch (err) {
          setError(err && err.message ? err.message : String(err))
        } finally {
          setLoading(false)
        }
      }, [])

      const switchLang = useCallback(async next => {
        if (next === lang || !data) { setLang(next); return }
        const target = data.url
        setSwitching(true)
        setLang(next)
        try {
          const fresh = await requestAnalysis(target, next)
          if (!fresh.analysis) {
            flash(fresh.modelError || '这次没有拿到译文，稍后再试一次')
            return
          }
          setData(fresh)
          setMessages([])
        } catch (err) {
          flash(err && err.message ? err.message : String(err))
        } finally {
          setSwitching(false)
        }
      }, [lang, data, flash])

      const copyText = lang === 'zh' ? UI.zh : (lang === 'en' ? UI.en : UI['zh-Hant'])

      const saveQuote = useCallback((text, noteData) => {
        const source = noteData || data
        if (!source) return
        const next = [
          {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            quote: text.replace(/\s+/g, ' ').trim().slice(0, 300),
            title: source.title,
            url: source.url,
            site: source.site,
            at: new Date().toISOString(),
          },
          ...notes,
        ].slice(0, 120)
        setNotes(next)
        writeNotes(next)
        setPick(null)
        try { window.getSelection()?.removeAllRanges() } catch { /* ignore */ }
        flash('已收进便签，回到首页就能看到')
      }, [data, notes, flash])

      const dropNote = useCallback(id => {
        const next = notes.filter(note => note.id !== id)
        setNotes(next)
        writeNotes(next)
        setPositions(previous => {
          if (!(id in previous)) return previous
          const rest = { ...previous }
          delete rest[id]
          writePositions(rest)
          return rest
        })
      }, [notes])

      const onMouseUp = useCallback(event => {
        if (!data) return
        const selection = window.getSelection()
        const text = selection ? String(selection).trim() : ''
        if (!selection || selection.isCollapsed || text.length < 3) {
          setPick(null)
          return
        }
        setPick({ x: Math.min(event.clientX, window.innerWidth - 190), y: event.clientY + 14, text })
      }, [data])

      useEffect(() => {
        const onDown = event => {
          if (pick && !event.target.closest?.('[data-adk-pick]')) setPick(null)
        }
        window.addEventListener('mousedown', onDown)
        return () => window.removeEventListener('mousedown', onDown)
      }, [pick])

      const ask = useCallback(async () => {
        const question = draft.trim()
        if (!question || asking || !data) return
        const history = messages
        setMessages([...history, { role: 'user', content: question }])
        setDraft('')
        setAsking(true)
        try {
          const response = await fetch('/article-desk/chat', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ url: data.url, question, history, lang }),
          })
          const body = await response.json()
          setMessages(list => [...list, {
            role: 'assistant',
            content: body.ok ? body.answer : `（没能回答：${body.error || '未知错误'}）`,
            sources: Array.isArray(body.sources) ? body.sources : [],
          }])
          if (body.ok) {
            setChatUsage(previous => ({
              turns: previous.turns + 1,
              input: previous.input + (body.usage?.input || 0),
              output: previous.output + (body.usage?.output || 0),
              total: previous.total + (body.usage?.total || 0),
            }))
          }
        } catch {
          setMessages(list => [...list, { role: 'assistant', content: '（请求失败，稍后再试）' }])
        } finally {
          setAsking(false)
        }
      }, [draft, asking, data, messages])

      const searchBar = (compact) => h('form', {
        key: 'search',
        onSubmit: event => { event.preventDefault(); open(input) },
        className: 'adk',
        style: {
          display: 'flex', alignItems: 'center', gap: 8, width: '100%',
          maxWidth: compact ? 560 : 640, marginTop: compact ? 0 : 34,
          padding: compact ? '4px 4px 4px 15px' : '5px 5px 5px 20px',
          borderRadius: compact ? 12 : 16, border: `1px solid ${V.border}`,
          background: 'rgba(233,228,219,0.05)', transition: 'border-color .2s ease, box-shadow .2s ease',
        },
      }, [
        h('input', {
          key: 'i',
          value: input,
          onChange: event => setInput(event.target.value),
          placeholder: '贴一个链接，直接给你结论、要点、逐段精读和评论',
          spellCheck: false,
          style: {
            flex: 1, minWidth: 0, height: compact ? 32 : 46, border: 'none',
            background: 'transparent', color: V.text, outline: 'none',
            fontSize: compact ? 13 : 15, fontFamily: 'inherit',
          },
        }),
        h('button', {
          key: 'go',
          type: 'submit',
          disabled: loading,
          title: '开始解读',
          style: {
            width: compact ? 32 : 42, height: compact ? 32 : 42, flexShrink: 0,
            borderRadius: '50%', cursor: loading ? 'default' : 'pointer',
            border: loading ? '1px solid rgba(233,228,219,0.12)' : '1px solid rgba(169,187,166,0.45)',
            background: loading ? 'transparent' : 'rgba(169,187,166,0.18)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          },
        }, loading
          ? h('span', {
            key: 'spin',
            style: {
              width: 13, height: 13, borderRadius: '50%',
              border: '1.6px solid rgba(233,228,219,0.25)', borderTopColor: V.sage,
              display: 'block', animation: 'adk-spin .9s linear infinite',
            },
          })
          : h('svg', {
            key: 'arrow', width: 17, height: 17, viewBox: '0 0 24 24', fill: 'none',
            stroke: V.sage, strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round',
          }, [
            h('path', { key: 'l', d: 'M4 12h15' }),
            h('path', { key: 'h', d: 'M13 6l6 6-6 6' }),
          ])),
      ])

      const resizeSticker = (event, id, base) => {
        event.stopPropagation()
        event.currentTarget.setPointerCapture?.(event.pointerId)
        resizeRef.current = { id, sx: event.clientX, sy: event.clientY, w: base.w, h: base.h }
      }

      const moveResize = event => {
        const resize = resizeRef.current
        if (resize === null) return
        const w = Math.max(180, Math.min(640, resize.w + (event.clientX - resize.sx) * 1.3))
        const h = Math.max(110, Math.min(720, resize.h + (event.clientY - resize.sy) * 1.3))
        setPositions(previous => ({ ...previous, [resize.id]: { ...(previous[resize.id] || {}), w, h } }))
      }

      const endResize = () => {
        if (resizeRef.current === null) return
        resizeRef.current = null
        setPositions(previous => { writePositions(previous); return previous })
      }

      const grip = (id, base) => h('div', {
        key: 'grip',
        onPointerDown: event => resizeSticker(event, id, base),
        onPointerMove: moveResize,
        onPointerUp: endResize,
        title: '拖动调整大小',
        style: {
          position: 'absolute', right: 3, bottom: 3, width: 15, height: 15,
          cursor: 'nwse-resize', opacity: 0.32, touchAction: 'none',
          background: 'linear-gradient(135deg, transparent 42%, #3a3730 42%, #3a3730 52%, transparent 52%, transparent 66%, #3a3730 66%, #3a3730 76%, transparent 76%)',
        },
      })

      const noteCard = (note, index = 0) => {
        let seed = 2166136261
        for (const char of String(note.id) + String(note.quote || '')) {
          seed ^= char.charCodeAt(0)
          seed = Math.imul(seed, 16777619) >>> 0
        }
        const tilt = ((seed % 44) - 22) / 10
        const spot = positions[note.id] || { x: 0, y: 0 }
        const box = { w: spot.w || 236, h: spot.h || 0 }
        const delay = Math.min(index * 55, 440)
        const dragging = activeDrag === note.id
        return h('div', {
          key: note.id,
          className: `adk-polaroid${landed === note.id ? ' adk-landed' : ''}`,
          onPointerDown: event => {
            if (event.button !== 0) return
            event.currentTarget.setPointerCapture?.(event.pointerId)
            setActiveDrag(note.id)
            const rect = event.currentTarget.parentElement.getBoundingClientRect()
            dragRef.current = {
              id: note.id, startX: event.clientX, startY: event.clientY,
              originX: spot.x, originY: spot.y, moved: false,
              startBottom: rect.bottom,
              limit: view === 'home' ? Infinity : window.innerHeight - DOCK_RESERVE,
              floor: view === 'home' ? 0 : null,
            }
          },
          onPointerMove: event => {
            const drag = dragRef.current
            if (drag === null || drag.id !== note.id) return
            const dx = event.clientX - drag.startX
            const dy = event.clientY - drag.startY
            if (!drag.moved && Math.abs(dx) + Math.abs(dy) < 4) return
            drag.moved = true
            let ny = drag.originY + dy
            const bottom = drag.startBottom + (ny - drag.originY)
            if (bottom > drag.limit) ny -= bottom - drag.limit
            if (drag.floor !== null && ny < drag.floor) ny = drag.floor
            setPositions(previous => ({
              ...previous,
              [note.id]: { ...(previous[note.id] || {}), x: drag.originX + dx, y: ny },
            }))
          },
          onPointerUp: () => {
            const drag = dragRef.current
            dragRef.current = null
            setActiveDrag(null)
            if (drag === null) return
            if (drag.moved) {
              setPositions(previous => {
                writePositions(previous)
                return previous
              })
              setLanded(note.id)
              if (landTimer.current) window.clearTimeout(landTimer.current)
              landTimer.current = window.setTimeout(() => setLanded(null), 700)
            } else {
              setOpened(note)
            }
          },
          style: {
            position: 'relative', background: NOTE_PAPERS[seed % NOTE_PAPERS.length], borderRadius: 3,
            width: box.w, height: box.h || undefined, minHeight: box.h || undefined,
            boxSizing: 'border-box', overflow: 'hidden',
            display: 'flex', flexDirection: 'column',
            padding: '22px 14px 12px',
            transform: `translate(${spot.x}px, ${spot.y}px) rotate(${spot.x === 0 && spot.y === 0 ? tilt : tilt * 0.4}deg)`,
            zIndex: dragging ? 6 : 1,
            scale: dragging ? 1.06 : 1,
            transition: 'scale .24s cubic-bezier(.34,1.56,.64,1), box-shadow .22s ease',
            animation: `adk-fadeIn .42s ease ${delay}ms both`,
            boxShadow: dragging ? '0 30px 60px rgba(0,0,0,0.5)' : '0 12px 26px rgba(0,0,0,0.38)',
            touchAction: 'none', userSelect: 'none',
          },
        }, [
          h('div', {
            key: 'tape',
            className: 'adk-tape',
            style: {
              position: 'absolute', top: -9, left: '50%', width: 78, height: 20,
              transform: 'translateX(-50%) rotate(-3.5deg)',
              background: 'linear-gradient(180deg, rgba(232,220,196,0.92), rgba(214,201,172,0.78))',
              boxShadow: '0 1px 3px rgba(0,0,0,0.18), inset 0 0 6px rgba(255,255,255,0.5)',
              borderLeft: '1px solid rgba(255,255,255,0.35)',
              borderRight: '1px solid rgba(255,255,255,0.35)',
            },
          }),
          h('div', {
            key: 'photo',
            style: {
              flex: 1, minHeight: 0, display: 'flex', overflow: 'auto',
              background: '#fffdf8', borderRadius: 2, padding: '13px 13px 15px',
              boxShadow: 'inset 0 0 0 1px rgba(58,55,48,0.07)',
            },
          }, h('div', {
            style: {
              fontSize: NOTE_FONT, lineHeight: 1.9, color: V.paperInk, letterSpacing: '0.02em',
              ...(box.h ? {} : { display: '-webkit-box', WebkitLineClamp: 6, WebkitBoxOrient: 'vertical' }),
              overflow: 'hidden', fontFamily: FONT_SERIF,
            },
          }, `「${note.quote}」`)),
          h('div', {
            key: 'cap',
            style: {
              marginTop: 'auto', paddingTop: 10, display: 'flex', justifyContent: 'space-between',
              alignItems: 'baseline', gap: 8, color: V.paperMuted, fontSize: 16,
            },
          }, [
            h('span', {
              key: 't',
              style: { maxWidth: '72%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
            }, note.title),
            h('span', { key: 'd', style: { flexShrink: 0, opacity: 0.75 } }, shortDate(note.at)),
          ]),
          grip(note.id, box),
        ])
      }

      const guideSpot = positions.guide || { x: 0, y: 0 }
      const guideW = guideSpot.w || 288
      const guideH = guideSpot.h || 236
      const guideCard = guideHidden
        ? h('button', {
          key: 'guide-restore',
          onClick: () => {
            setGuideHidden(false)
            try { window.localStorage.setItem(GUIDE_HIDDEN_KEY, '0') } catch { /* ignore */ }
          },
          style: {
            alignSelf: 'flex-start', height: 34, padding: '0 14px', borderRadius: 9,
            border: `1px dashed ${V.border}`, background: 'transparent', color: V.faint,
            fontSize: 12, fontFamily: 'inherit', cursor: 'pointer',
          },
        }, '＋ 使用指南')
        : h('div', {
          key: 'guide',
          className: 'adk-polaroid',
          onPointerDown: event => {
            if (event.button !== 0) return
            event.currentTarget.setPointerCapture?.(event.pointerId)
            setActiveDrag('guide')
            const rect = event.currentTarget.getBoundingClientRect()
            dragRef.current = {
              id: 'guide', startX: event.clientX, startY: event.clientY,
              originX: guideSpot.x, originY: guideSpot.y, moved: false,
              startBottom: rect.bottom,
              limit: view === 'home' ? Infinity : window.innerHeight - DOCK_RESERVE,
              floor: view === 'home' ? 0 : null,
            }
          },
          onPointerMove: event => {
            const drag = dragRef.current
            if (drag === null || drag.id !== 'guide') return
            const dx = event.clientX - drag.startX
            const dy = event.clientY - drag.startY
            if (!drag.moved && Math.abs(dx) + Math.abs(dy) < 4) return
            drag.moved = true
            let ny = drag.originY + dy
            const bottom = drag.startBottom + (ny - drag.originY)
            if (bottom > drag.limit) ny -= bottom - drag.limit
            if (drag.floor !== null && ny < drag.floor) ny = drag.floor
            setPositions(previous => ({ ...previous, guide: { ...(previous.guide || {}), x: drag.originX + dx, y: ny } }))
          },
          onPointerUp: () => {
            const drag = dragRef.current
            dragRef.current = null
            setActiveDrag(null)
            if (drag === null) return
            if (drag.moved) {
              setPositions(previous => { writePositions(previous); return previous })
            } else {
              setEditingGuide(true)
            }
          },
          style: {
            position: 'relative', width: guideW, minHeight: guideH,
            background: NOTE_PAPERS[0], borderRadius: 3, padding: '24px 16px 12px',
            transform: `translate(${guideSpot.x}px, ${guideSpot.y}px) rotate(-1.2deg)`,
            animation: 'adk-fadeIn .42s ease both',
            boxShadow: '0 12px 26px rgba(0,0,0,0.32)',
            display: 'flex', flexDirection: 'column', flexShrink: 0, cursor: 'grab',
            scale: activeDrag === 'guide' ? 1.05 : 1,
            transition: 'scale .24s cubic-bezier(.34,1.56,.64,1), box-shadow .22s ease',
          },
        }, [
          h('div', {
            key: 'tape',
            className: 'adk-tape',
            style: {
              position: 'absolute', top: -9, left: '50%', width: 78, height: 20,
              transform: 'translateX(-50%) rotate(-3.5deg)', cursor: 'grab',
              background: 'linear-gradient(180deg, rgba(232,220,196,0.92), rgba(214,201,172,0.78))',
              boxShadow: '0 1px 3px rgba(0,0,0,0.18), inset 0 0 6px rgba(255,255,255,0.5)',
            },
          }),
          h('div', {
            key: 'photo',
            style: {
              flex: 1, display: 'flex', background: '#fffdf8', borderRadius: 2,
              padding: '13px 13px 15px', boxShadow: 'inset 0 0 0 1px rgba(58,55,48,0.07)',
            },
          }, h('div', {
            key: 'body',
            style: {
              flex: 1, width: '100%', overflow: 'hidden',
              fontFamily: FONT_SERIF, fontSize: NOTE_FONT, lineHeight: 1.95, color: V.paperInk,
              letterSpacing: '0.01em', whiteSpace: 'pre-wrap',
              display: '-webkit-box', WebkitLineClamp: 7, WebkitBoxOrient: 'vertical',
            },
          }, guideText)),
          h('div', {
            key: 'cap',
            style: {
              marginTop: 10, display: 'flex', justifyContent: 'space-between',
              alignItems: 'baseline', gap: 8, color: V.paperMuted, fontSize: 16,
            },
          }, [
            h('span', { key: 't', style: { maxWidth: '72%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, '使用指南'),
          ]),
          grip('guide', { w: guideW, h: guideH }),
        ])

      const historyPanel = h('div', {
        key: 'history',
        className: 'adk-history',
        style: { position: 'absolute', left: 22, top: 20, zIndex: 20, width: 300 },
      }, [
        h('button', {
          key: 'toggle',
          onClick: () => setHistoryOpen(value => !value),
          style: {
            display: 'inline-flex', alignItems: 'center', gap: 7,
            height: 30, padding: '0 12px', borderRadius: 9,
            border: `1px solid ${historyOpen ? V.border : 'transparent'}`,
            background: historyOpen ? V.card : 'transparent',
            color: historyOpen ? V.text : V.faint,
            fontSize: 12, fontFamily: 'inherit', cursor: 'pointer', letterSpacing: '0.06em',
          },
        }, [
          h('span', { key: 'i', style: { fontSize: 12, opacity: 0.85 } }, historyOpen ? '×' : '◷'),
          h('span', { key: 't' }, history.length > 0 ? `${copyText.history} · ${history.length}` : copyText.history),
        ]),
        historyOpen
          ? h('div', {
            key: 'panel',
            style: {
              marginTop: 8, padding: 7, borderRadius: 12,
              background: V.surface, border: `1px solid ${V.border}`,
              boxShadow: '0 18px 44px rgba(0,0,0,0.32)',
              animation: 'adk-fadeIn .18s ease both',
            },
          }, [
            history.length === 0
              ? h('div', { key: 'empty', style: { padding: '10px 8px', fontSize: 12, color: V.faint, lineHeight: 1.8 } }, copyText.historyEmpty)
              : h('div', { key: 'list', style: { display: 'flex', flexDirection: 'column', gap: 1, maxHeight: '58vh', overflowY: 'auto' } },
                history.map(item => h('button', {
                  key: item.url,
                  onClick: () => { setHistoryOpen(false); open(item.url) },
                  title: item.url,
                  style: {
                    display: 'flex', flexDirection: 'column', gap: 2, textAlign: 'left',
                    padding: '8px 9px', borderRadius: 8, border: 'none', cursor: 'pointer',
                    background: 'transparent', color: V.body, fontFamily: 'inherit',
                  },
                  onMouseEnter: event => { event.currentTarget.style.background = V.card },
                  onMouseLeave: event => { event.currentTarget.style.background = 'transparent' },
                }, [
                  h('span', {
                    key: 't',
                    style: {
                      fontSize: 12.5, lineHeight: 1.55, color: V.text,
                      display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                    },
                  }, item.title),
                  h('span', { key: 'm', style: { fontSize: 10.5, color: V.faint } },
                    [item.site, shortDate(item.at)].filter(Boolean).join(' · ')),
                ]))),
            history.length > 0
              ? h('button', {
                key: 'clear',
                onClick: () => { setHistory([]); writeHistory([]) },
                style: {
                  width: '100%', marginTop: 4, padding: '7px 0', borderRadius: 8,
                  border: 'none', background: 'transparent', color: V.faint,
                  fontSize: 11.5, cursor: 'pointer', fontFamily: 'inherit',
                },
              }, '清空记录')
              : null,
          ])
          : null,
      ])
      const loadingOverlay = (loading || curtain) ? h('div', {
        key: 'loading',
        style: {
          position: 'absolute', inset: 0, zIndex: 40, background: V.bg,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 26,
          opacity: fading ? 0 : 1, transition: 'opacity .32s ease',
          pointerEvents: fading ? 'none' : 'auto',
        },
      }, [
        h('div', {
          key: 'book',
          style: { perspective: 1100, width: 168, height: 214, position: 'relative' },
        }, [
          h('div', {
            key: 'under',
            style: {
              position: 'absolute', inset: 0, borderRadius: 5,
              background: 'linear-gradient(135deg, #f5efe2, #e8dfcd)',
              boxShadow: '0 18px 40px rgba(0,0,0,0.22)',
            },
          }),
          h('div', {
            key: 'page',
            style: {
              position: 'absolute', inset: 0, borderRadius: 5,
              transformOrigin: 'left center',
              background: 'linear-gradient(135deg, #fffdf8, #f2ebdc)',
              borderLeft: '1px solid rgba(58,55,48,0.12)',
              boxShadow: '0 12px 26px rgba(0,0,0,0.18)',
              animation: 'adk-pageOpen 1.9s cubic-bezier(.45,.05,.25,1) infinite',
            },
          }, h('div', {
            key: 'lines',
            style: { padding: '26px 20px', display: 'flex', flexDirection: 'column', gap: 9 },
          }, [0, 1, 2, 3, 4, 5].map(index => h('div', {
            key: index,
            style: {
              height: 5, borderRadius: 3, background: 'rgba(58,55,48,0.16)',
              width: `${100 - (index % 3) * 12}%`,
              animation: `adk-pageGlow 2.4s ease ${index * 110}ms infinite`,
            },
          })))),
        ]),
        h('div', {
          key: 'label',
          style: { fontSize: 12, letterSpacing: '0.3em', color: V.faint, textTransform: 'uppercase' },
        }, '正在翻开这一页'),
      ]) : null
      const home = h('div', {
        key: 'home',
        className: 'adk adk-scroll',
        style: {
          position: 'relative', height: '100%', overflowY: 'auto',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          padding: '9vh 32px 140px',
          background: V.glow,
        },
      }, [
        historyPanel,
        h('div', {
          key: 'brand',
          style: {
            fontSize: 12.5, letterSpacing: '0.42em', color: V.faint,
            textTransform: 'uppercase', marginBottom: 18,
          },
        }, 'Between Pages'),
        h('h1', {
          key: 'title',
          style: {
            fontSize: 40, fontWeight: 700, letterSpacing: '0.1em', fontFamily: FONT_SERIF,
            margin: '0 0 14px', color: V.text,
          },
        }, '页间'),
        searchBar(false),
        error ? h('div', {
          key: 'err',
          style: { marginTop: 16, fontSize: 12.5, color: V.rose, maxWidth: 620, textAlign: 'center', lineHeight: 1.7 },
        }, error) : null,

        h('div', { key: 'shelf', style: { width: '100%', maxWidth: 980, marginTop: 22, display: 'flex', flexWrap: 'wrap', gap: 22, alignItems: 'flex-start' } }, [
          guideCard,
          ...notes.map((note, index) => noteCard(note, index + 1)),
        ]),
      ])

      const analysis = data && data.analysis
        ? {
          ...data.analysis,
          points: Array.isArray(data.analysis.points) ? data.analysis.points : [],
          sections: Array.isArray(data.analysis.sections) ? data.analysis.sections : [],
          commentary: data.analysis.commentary || {},
        }
        : null

      const renderAnalysis = () => {
        if (data && data.pending) {
          return h('div', {
            key: 'pending',
            style: {
              display: 'flex', alignItems: 'center', gap: 10, margin: '10px 0 26px',
              color: V.muted, fontSize: 13,
            },
          }, [
            h('span', {
              key: 'spin',
              style: {
                width: 12, height: 12, borderRadius: '50%', display: 'block',
                border: `1.6px solid ${V.border}`, borderTopColor: V.sage,
                animation: 'adk-spin .9s linear infinite',
              },
            }),
            h('span', { key: 't' }, '正文已读取，正在写解读…'),
          ])
        }
        if (!analysis || (!analysis.oneLiner && analysis.points.length === 0 && analysis.sections.length === 0)) {
          if (data && data.rawText) {
            return h('div', { key: 'raw', style: { marginBottom: 26 } }, [
              h('div', {
                key: 'h',
                style: { fontSize: 16, letterSpacing: '0.22em', color: V.faint, textTransform: 'uppercase', marginBottom: 10 },
              }, '模型输出（未结构化）'),
              h('div', {
                key: 'b',
                style: {
                  fontSize: 16, lineHeight: 1.9, whiteSpace: 'pre-wrap',
                  color: V.body, padding: '16px 18px',
                  border: `1px solid ${V.border}`, borderRadius: 12, background: V.card,
                },
              }, data.rawText),
            ])
          }
          return h('div', {
            key: 'noa',
            style: {
              border: `1px dashed ${V.border}`, borderRadius: 12, padding: '18px 20px',
              color: V.muted, fontSize: 16, marginBottom: 26, lineHeight: 1.8,
            },
          }, data && data.modelError
            ? `这次没拿到解读：${data.modelError}。下面是原文，可以稍后再试，或在对话里让我分析。`
            : '这次没有生成解读，下面是原文。')
        }

        return h('div', { key: 'analysis', className: 'adk-fade' }, [
          analysis.oneLiner ? h('div', {
            key: 'one',
            style: {
              display: 'flex', gap: 14, padding: '18px 20px', borderRadius: 13,
              background: 'rgba(169,187,166,0.09)', border: `1px solid rgba(169,187,166,0.22)`,
              marginBottom: 26,
            },
          }, [
            h('div', { key: 'bar', style: { width: 3, borderRadius: 3, background: V.sage, flexShrink: 0 } }),
            h('div', { key: 't', style: { fontSize: 16, lineHeight: 1.75, color: V.text, fontFamily: FONT_SERIF } }, rich(analysis.oneLiner)),
          ]) : null,

          analysis.points.length > 0 ? h('section', { key: 'points', style: { marginBottom: 30 } }, [
            sectionTitle(copyText.points),
            h('div', { style: { display: 'flex', flexDirection: 'column', gap: 13 } },
              analysis.points.map((point, index) => h('div', {
                key: index,
                style: { display: 'flex', alignItems: 'baseline', gap: 12, fontSize: 14.5, lineHeight: 1.8, color: V.text },
              }, [
                h('span', {
                  key: 'n',
                  style: {
                    flexShrink: 0, width: 22, textAlign: 'right',
                    color: ACCENTS[index % ACCENTS.length], fontSize: 13, fontVariantNumeric: 'tabular-nums',
                  },
                }, String(index + 1).padStart(2, '0')),
                h('span', { key: 't', style: { flex: 1, minWidth: 0 } }, rich(point, ACCENTS[index % ACCENTS.length])),
              ]))),
          ]) : null,

          analysis.sections.length > 0 ? h('section', { key: 'sections', style: { marginBottom: 30 } }, [
            sectionTitle(copyText.sections),
            ...analysis.sections.map((section, index) => {
              const accent = ACCENTS[index % ACCENTS.length]
              return h('div', {
                key: index,
                style: {
                  marginTop: index > 0 ? 22 : 0,
                  paddingTop: index > 0 ? 22 : 0,
                  marginBottom: index < analysis.sections.length - 1 ? 0 : 6,
                  borderTop: index > 0 ? `1px solid ${V.border}` : 'none',
                },
              }, [
                h('div', {
                  key: 'h',
                  style: { display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 8 },
                }, [
                  h('span', { key: 't', style: { fontSize: 16, fontWeight: 700, color: V.text, letterSpacing: '0.01em', fontFamily: FONT_SERIF } }, section.title),
                  h('span', {
                    key: 'k',
                    style: {
                      fontSize: 12.5, letterSpacing: '0.1em', color: accent,
                      border: `1px solid ${accent}55`, borderRadius: 6, padding: '1px 7px',
                    },
                  }, section.type),
                ]),
                section.key ? h('div', {
                  key: 'key',
                  style: { fontSize: 15.5, fontWeight: 700, lineHeight: 1.7, color: accent, marginBottom: 7, letterSpacing: '0.01em' },
                }, rich(section.key, accent)) : null,
                section.body ? h('div', {
                  key: 'body',
                  style: { fontSize: 16, lineHeight: 1.9, color: V.ink, marginBottom: section.data ? 7 : 0 },
                }, rich(section.body, V.ink)) : null,
                section.data ? h('div', {
                  key: 'data',
                  style: { display: 'flex', gap: 8, alignItems: 'baseline' },
                }, [
                  h('span', {
                    key: 'c',
                    style: {
                      flexShrink: 0, fontSize: 10, letterSpacing: '0.08em', color: V.sand,
                      border: `1px solid ${accent}44`, borderRadius: 4, padding: '1px 5px',
                    },
                  }, copyText.note),
                  h('span', { key: 't', style: { fontSize: 13.2, lineHeight: 1.8, color: V.body } }, rich(section.data)),
                ]) : null,
              ])
            }),
          ]) : null,

          h('section', { key: 'commentary', style: { marginBottom: 30 } }, [
            sectionTitle(copyText.commentary),
            ...[
              [copyText.labels[0], analysis.commentary.persuaded, V.sage],
              [copyText.labels[1], analysis.commentary.doubts, V.rose],
              [copyText.labels[2], analysis.commentary.frame, V.blue],
              [copyText.labels[3], analysis.commentary.use, V.sand],
            ].filter(([, body]) => body).map(([label, body, color], index) => h('div', {
              key: index,
              style: {
                display: 'flex', alignItems: 'baseline', gap: 14, marginBottom: 14,
                paddingLeft: 13, borderLeft: `2px solid ${color}55`,
              },
            }, [
              h('div', { key: 'l', style: { width: 88, flexShrink: 0, textAlign: 'left', fontSize: 12.5, lineHeight: 1.95, color, letterSpacing: '0.04em' } }, label),
              h('div', { key: 'b', style: { flex: 1, minWidth: 0, fontSize: 14.5, lineHeight: 1.95, color: V.body, letterSpacing: '0.01em', fontFamily: FONT_SANS } }, rich(body)),
            ])),
            [analysis.commentary.persuaded, analysis.commentary.doubts, analysis.commentary.frame, analysis.commentary.use].some(Boolean)
              ? null
              : h('div', { key: 'none', style: { fontSize: 12.5, color: V.faint, lineHeight: 1.9 } },
                '这次的模型没有写出评论部分，重新贴一次链接就会重写。'),
          ]),
        ])
      }

      const messageBubble = (message, index) => h('div', {
        key: index,
        style: {
          alignSelf: message.role === 'user' ? 'flex-end' : 'flex-start',
          maxWidth: '88%', padding: '9px 13px', borderRadius: 11,
          fontSize: 13.5, lineHeight: 1.8,
          background: message.role === 'user' ? 'rgba(198,176,146,0.16)' : 'rgba(233,228,219,0.055)',
          border: `1px solid ${message.role === 'user' ? 'rgba(198,176,146,0.34)' : V.border}`,
          color: V.body, whiteSpace: 'pre-wrap',
        },
      }, message.content)

      const chatChips = h('div', { key: 'chips', style: { display: 'flex', gap: 8, flexWrap: 'wrap' } },
        ['这篇的数据可信吗？', '和另一篇对照怎么看？', '对我意味着什么？'].map(text => h('button', {
          key: text,
          className: 'adk-chip',
          onClick: () => {
            setDraft(text)
            setChatOpen(true)
            window.setTimeout(() => inputRef.current?.focus(), 0)
          },
          style: {
            height: 28, padding: '0 12px', borderRadius: 999, cursor: 'pointer',
            border: '1px solid rgba(198,176,146,0.32)', background: 'rgba(198,176,146,0.08)',
            color: 'rgba(226,206,178,0.9)', fontSize: 12.5, fontFamily: 'inherit',
          },
        }, text)))

      const usageBits = []
      if (data && data.usage && data.usage.total > 0) usageBits.push(`解读 ${fmtTokens(data.usage.total)} tokens`)
      if (chatUsage.total > 0) usageBits.push(`对谈 ${chatUsage.turns} 轮 ${fmtTokens(chatUsage.total)} tokens`)
      if (data && data.model) usageBits.push(data.model)

      const chatDock = data ? h('div', {
        key: 'dock',
        style: {
          padding: '10px 22px 26px',
          background: V.dock,
        },
      }, [
        chatOpen ? h('div', {
          key: 'thread',
          style: {
            maxWidth: 880, margin: '0 auto 10px', background: V.surface,
            border: `1px solid ${V.border}`, borderRadius: 14, overflow: 'hidden',
            boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
          },
        }, [
          h('div', {
            key: 'head',
            style: {
              display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px',
              borderBottom: `1px solid ${V.border}`,
            },
          }, [
            h('span', { key: 'd', style: { width: 6, height: 6, borderRadius: '50%', background: '#c6b092' } }),
            h('span', { key: 't', style: { fontSize: 12.5, letterSpacing: '0.16em', color: V.muted } }, '对谈记录'),
            h('button', {
              key: 'x',
              onClick: () => setChatOpen(false),
              style: {
                marginLeft: 'auto', border: 'none', background: 'transparent',
                color: V.faint, cursor: 'pointer', fontSize: 16,
              },
            }, '收起'),
          ]),
          h('div', {
            key: 'msgs',
            className: 'adk-scroll',
            style: {
              maxHeight: '42vh', overflowY: 'auto', padding: '14px 14px 4px',
              display: 'flex', flexDirection: 'column', gap: 10,
            },
          }, messages.length > 0
            ? messages.map(messageBubble)
            : h('div', { key: 'empty', style: { fontSize: 12.5, color: V.faint, padding: '2px 0 10px' } },
              '还没有对话。可以从下面选一个问题，或者直接输入。')),
          h('div', { key: 'chips', style: { padding: '6px 14px 14px' } }, chatChips),
        ]) : null,
        h('div', { key: 'bar', style: { maxWidth: 1040, margin: '0 auto', position: 'relative' } }, [
          h('div', {
            style: {
              display: 'flex', alignItems: 'center', gap: 9,
              background: V.surface, border: `1px solid ${V.border}`,
              borderRadius: 18, padding: '8px 6px 8px 18px',
              boxShadow: '0 16px 42px rgba(0,0,0,0.45)',
            },
          }, [
            h('input', {
              key: 'i',
              ref: inputRef,
              value: draft,
              onChange: event => setDraft(event.target.value),
              onKeyDown: event => { if (event.key === 'Enter') ask() },
              onFocus: () => setChatOpen(true),
              placeholder: copyText.ask,
              style: {
                flex: 1, minWidth: 0, height: 38, border: 'none', background: 'transparent',
                color: V.text, fontSize: 13.5, outline: 'none', fontFamily: 'inherit',
              },
            }),
            messages.length > 0 ? h('button', {
              key: 'count',
              onClick: () => setChatOpen(value => !value),
              style: {
                height: 24, padding: '0 9px', borderRadius: 999, flexShrink: 0, cursor: 'pointer',
                border: `1px solid ${V.border}`, background: 'transparent',
                color: V.muted, fontSize: 16, fontFamily: 'inherit', whiteSpace: 'nowrap',
              },
            }, `${messages.length} 条`) : null,
            h('button', {
              key: 'send',
              onClick: ask,
              disabled: asking,
              title: '发送',
              style: {
                width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                border: '1px solid rgba(255,255,255,0.1)', cursor: asking ? 'default' : 'pointer',
                background: asking ? 'rgba(233,228,219,0.07)' : 'linear-gradient(180deg,#dcc7a1,#c0a97f)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: asking ? 'none' : '0 3px 12px rgba(192,169,127,0.3)',
              },
            }, asking
              ? h('span', {
                key: 'spin',
                style: {
                  width: 12, height: 12, borderRadius: '50%',
                  border: '1.5px solid rgba(30,26,18,0.25)', borderTopColor: '#2a2418',
                  display: 'block', animation: 'adk-spin .9s linear infinite',
                },
              })
              : h('svg', {
                key: 'arrow', width: 15, height: 15, viewBox: '0 0 24 24', fill: 'none',
                stroke: '#2a2418', strokeWidth: 2.4, strokeLinecap: 'round', strokeLinejoin: 'round',
              }, [h('path', { key: 'l', d: 'M12 19V5' }), h('path', { key: 'h', d: 'M6 11l6-6 6 6' })]))
          ]),
        ]),
      ]) : null

      const mapSrc = data ? (isLight && data.mapLight ? data.mapLight : data.map) : ''

      const articleView = data ? h('div', {
        key: 'article',
        className: 'adk',
        onMouseUp: onMouseUp,
        style: {
          position: 'relative', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden',
          background: V.glow,
        },
      }, [
        h('div', {
          key: 'bar',
          style: {
            position: 'sticky', top: 0, zIndex: 6, display: 'flex', gap: 12, alignItems: 'center',
            padding: '11px 26px', background: V.surface, backdropFilter: 'blur(12px)',
            borderBottom: `1px solid ${V.border}`,
          },
        }, [
          h('button', {
            key: 'back', className: 'adk-btn',
            onClick: () => { setView('home'); setData(null); setError(''); setPick(null) },
            style: {
              height: 34, padding: '0 13px', borderRadius: 9, border: `1px solid ${V.border}`,
              background: 'transparent', color: V.muted, cursor: 'pointer', fontSize: 12.5, whiteSpace: 'nowrap',
            },
          }, '← 首页'),
          searchBar(true),
          h('div', {
            key: 'langs',
            style: {
              display: 'flex', gap: 2, flexShrink: 0, marginLeft: 'auto',
              padding: 2, borderRadius: 9, border: `1px solid ${V.border}`,
            },
          }, LANGS.map(item => h('button', {
            key: item.id,
            onClick: () => switchLang(item.id),
            disabled: switching,
            style: {
              height: 26, minWidth: 30, padding: '0 8px', borderRadius: 7, cursor: 'pointer',
              border: 'none', fontSize: 11.5, fontFamily: 'inherit',
              background: lang === item.id ? V.cardHi : 'transparent',
              color: lang === item.id ? V.text : V.faint,
              fontWeight: lang === item.id ? 700 : 400,
            },
          }, item.label))),
        ]),
        switching ? h('div', {
          key: 'switching',
          style: {
            position: 'absolute', top: 64, left: '50%', transform: 'translateX(-50%)', zIndex: 9,
            display: 'flex', alignItems: 'center', gap: 9,
            background: V.surface, border: `1px solid ${V.border}`, borderRadius: 999,
            padding: '7px 16px', boxShadow: '0 12px 30px rgba(0,0,0,0.28)',
            fontSize: 12.5, color: V.text, letterSpacing: '0.06em',
          },
        }, [
          h('span', {
            key: 'spin',
            style: {
              width: 12, height: 12, borderRadius: '50%',
              border: `1.6px solid ${V.border}`, borderTopColor: V.sage,
              display: 'block', animation: 'adk-spin .9s linear infinite',
            },
          }),
          h('span', { key: 't' }, lang === 'en' ? 'Translating…' : (lang === 'zh-Hant' ? '轉換中…' : '转换中…')),
        ]) : null,
        h('div', { key: 'scroll', className: 'adk-scroll', style: { flex: 1, minHeight: 0, overflowY: 'auto', opacity: switching ? 0.45 : 1, transition: 'opacity .2s ease' } }, [
        h('div', {
          key: data.pending ? 'body-pending' : 'body-ready',
          style: {
            maxWidth: 880, margin: '0 auto', padding: '30px 26px 110px',
            animation: 'adk-pageIn .5s cubic-bezier(.22,.8,.24,1) both',
            transformOrigin: 'left center',
          },
        }, [
          h('div', {
            key: 'kicker',
            style: { fontSize: 12.5, letterSpacing: '0.3em', color: V.faint, marginBottom: 12, textTransform: 'uppercase' },
          }, 'Reading'),
          h('h2', {
            key: 'title',
            style: { fontSize: 27, fontWeight: 700, lineHeight: 1.45, margin: '0 0 12px', color: V.text, letterSpacing: '0.01em', fontFamily: FONT_SERIF },
          }, data.title || '（未识别到标题）'),
          h('div', {
            key: 'meta',
            style: { fontSize: 12.5, color: V.faint, display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 26 },
          }, [
            h('span', { key: 'bits', style: { letterSpacing: '0.02em' } },
              [data.site, data.published, data.words ? `${data.words} 字` : '', data.readingMinutes ? `约 ${data.readingMinutes} 分钟` : '']
                .filter(Boolean).join(' · ')),
            h('a', {
              key: 'src', href: data.url, target: '_blank', rel: 'noreferrer',
              style: { color: V.blue, textDecoration: 'none' },
            }, '原文 ↗'),
          ]),
          data.map ? h('div', { key: 'map', style: { marginBottom: 28 } }, [
            h('div', {
              key: 'cap',
              style: { display: 'flex', justifyContent: 'space-between', marginBottom: 9 },
            }, [
              h('span', { key: 'l', style: { fontSize: 16, letterSpacing: '0.22em', color: V.faint, textTransform: 'uppercase' } }, copyText.map),
              h('span', { key: 'r', style: { fontSize: 16, color: V.faint } }, copyText.mapHint),
            ]),
            h('img', {
              key: 'img', src: mapSrc, alt: '结构导图',
              onError: event => {
                const img = event.currentTarget
                const fallback = mapSrc === data.mapLight ? data.map : data.mapLight
                if (fallback && img.src.indexOf(fallback) < 0 && img.dataset.fallback !== '1') {
                  img.dataset.fallback = '1'
                  img.src = fallback
                }
              },
              onClick: () => setZoom(1),
              style: {
                width: '100%', borderRadius: 13, cursor: 'zoom-in',
                border: `1px solid ${V.border}`, display: 'block',
              },
            }),
          ]) : null,
          renderAnalysis(),
          h('button', {
            key: 'toggle',
            className: 'adk-btn',
            onClick: () => {
              if (!showText) { setShowText(true); return }
              setFolding(true)
              window.setTimeout(() => {
                setShowText(false)
                setFolding(false)
              }, 300)
            },
            style: {
              width: '100%', height: 40, marginTop: 26, marginBottom: 18, cursor: 'pointer',
              borderRadius: 11, border: `1px solid ${V.border}`,
              background: 'rgba(233,228,219,0.035)', color: V.muted,
              fontSize: 12.5, letterSpacing: '0.1em',
            },
          }, showText ? copyText.hide : copyText.show),
          showText ? h('div', {
            key: 'text',
            style: {
              fontSize: 14.5, lineHeight: 1.98, color: V.body,
              animation: folding
                ? 'adk-foldUp .3s cubic-bezier(.4,0,.6,1) both'
                : 'adk-unfold .55s cubic-bezier(.2,.8,.2,1) both',
              paddingBottom: 40, borderTop: `1px solid ${V.border}`, paddingTop: 22,
              marginBottom: 20,
            },
          }, renderMarkdown(data.markdown, { text: V.ink, muted: V.muted, faint: V.faint, card: V.card, border: V.border, blue: V.blue })) : null,
          h('div', {
            key: 'footer',
            style: {
              marginTop: 30, paddingTop: 18, borderTop: `1px solid ${V.border}`,
              display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
            },
          }, [
            usageBits.length > 0 ? h('span', {
              key: 'usage',
              style: { fontSize: 11.5, color: V.faint, letterSpacing: '0.04em' },
            }, usageBits.join(' · ')) : null,
            h('div', { key: 'spacer', style: { flex: 1 } }),
            h('button', {
              key: 'copy',
              className: 'adk-btn',
              onClick: async () => {
                const a = data.analysis
                const out = []
                out.push(`# ${data.title || ''}`, '')
                out.push(`**来源**：${data.url}`)
                if (data.site) out.push(`**站点**：${data.site}`)
                if (data.published) out.push(`**发布**：${data.published}`)
                if (a && a.oneLiner) { out.push('', `> ${a.oneLiner}`) }
                if (a && a.points.length > 0) {
                  out.push('', '## 要点')
                  for (const point of a.points) out.push(`- ${point}`)
                }
                if (a && a.sections.length > 0) {
                  out.push('', '## 逐段精读')
                  for (const section of a.sections) {
                    out.push('', `### ${section.title}`)
                    if (section.key) out.push(`**${section.key}**`)
                    if (section.body) out.push(section.body)
                    if (section.data) out.push(`数据｜${section.data}`)
                  }
                }
                if (a && a.commentary) {
                  out.push('', '## 读后评论')
                  for (const [label, value] of [['说服我的地方', a.commentary.persuaded], ['我存疑的地方', a.commentary.doubts], ['换个坐标系', a.commentary.frame], ['可以怎么用', a.commentary.use]]) {
                    if (value) out.push('', `**${label}**：${value}`)
                  }
                }
                out.push('', '---', `原文链接：${data.url}`)
                try {
                  await navigator.clipboard.writeText(out.join('\n'))
                  flash('Notion 版已复制，打开 Notion 粘贴即可')
                } catch {
                  flash('复制失败，可以多试一次')
                }
              },
              style: {
                height: 34, padding: '0 16px', borderRadius: 9, cursor: 'pointer',
                border: `1px solid ${V.border}`, background: 'transparent',
                color: V.text, fontSize: 12.5, fontFamily: 'inherit',
              },
            }, copyText.export),
            h('a', {
              key: 'notion',
              href: 'https://www.notion.so/new',
              target: '_blank',
              rel: 'noreferrer',
              style: {
                height: 34, display: 'inline-flex', alignItems: 'center', padding: '0 14px',
                borderRadius: 9, border: `1px solid ${V.border}`, color: V.muted,
                fontSize: 12.5, textDecoration: 'none',
              },
            }, copyText.notion),
          ]),
        ]),
        ]),
        chatDock,
      ]) : null

      return h('div', {
        className: `adk ${isLight ? 'adg-light' : 'adg-dark'}`,
        style: {
          position: 'relative', height: '100%', width: '100%', overflow: 'hidden',
          fontFamily: FONT_SANS, color: V.text, background: V.bg,
        },
      }, [
        h('style', { key: 'css' }, CSS),
        h('style', { key: 'theme' }, THEME_CSS),
        view === 'home' || !data ? home : articleView,
        loadingOverlay,
        pick ? h('div', {
          key: 'pick',
          'data-adk-pick': 'true',
          style: {
            position: 'fixed', left: pick.x, top: pick.y, zIndex: 9998,
            display: 'flex', alignItems: 'center', gap: 8,
            background: 'transparent', border: 'none', padding: 0,
            color: V.text,
          },
          onMouseDown: event => event.preventDefault(),
        }, [
          h('button', {
            key: 's',
            onClick: () => saveQuote(pick.text),
            style: {
              display: 'inline-flex', alignItems: 'center', gap: 5,
              height: 26, padding: '0 11px', borderRadius: 7, cursor: 'pointer',
              border: `1px solid ${V.action}`,
              background: V.action, color: V.actionInk,
              fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap',
              boxShadow: '0 4px 14px rgba(0,0,0,0.22)',
            },
          }, [
            h('svg', { key: 'i', width: 12, height: 12, viewBox: '0 0 24 24', fill: 'none', stroke: V.actionInk, strokeWidth: 2.2, strokeLinecap: 'round', strokeLinejoin: 'round' },
              h('path', { d: 'M6 4h12v17l-6-4.2L6 21z' })),
            h('span', { key: 't' }, '收进便签'),
          ]),
        ]) : null,
        editingGuide ? h('div', {
          key: 'guidemodal',
          style: {
            position: 'fixed', inset: 0, zIndex: 9997, background: 'rgba(8,9,12,0.78)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
          },
          onClick: () => setEditingGuide(false),
        }, [
          h('div', {
            key: 'card',
            onClick: event => event.stopPropagation(),
            style: {
              position: 'relative', width: 'min(560px, 92vw)', background: NOTE_PAPERS[0],
              borderRadius: 5, padding: '34px 32px 24px',
              boxShadow: '0 34px 90px rgba(0,0,0,0.6)',
            },
          }, [
            h('div', {
              key: 'tape',
              style: {
                position: 'absolute', top: -11, left: '50%', width: 96, height: 24,
                transform: 'translateX(-50%) rotate(-2.5deg)',
                background: 'linear-gradient(180deg, rgba(232,220,196,0.94), rgba(214,201,172,0.8))',
                boxShadow: '0 1px 4px rgba(0,0,0,0.2), inset 0 0 8px rgba(255,255,255,0.5)',
              },
            }),
            h('textarea', {
              key: 'body',
              value: guideText,
              onChange: event => {
                const next = event.target.value.slice(0, 1200)
                setGuideText(next)
                try { window.localStorage.setItem(GUIDE_KEY, next) } catch { /* ignore */ }
              },
              rows: 10,
              style: {
                width: '100%', boxSizing: 'border-box', border: 'none', outline: 'none',
                resize: 'vertical', background: 'transparent', padding: 0, marginBottom: 18,
                fontFamily: FONT_SERIF, fontSize: 15, lineHeight: 1.95, color: V.paperInk,
                letterSpacing: '0.01em',
              },
            }),
            h('div', { key: 'actions', style: { display: 'flex', gap: 10, flexWrap: 'wrap' } }, [
              h('button', {
                key: 'save',
                onClick: () => setEditingGuide(false),
                style: {
                  height: 36, padding: '0 16px', borderRadius: 9, cursor: 'pointer',
                  border: '1px solid rgba(58,55,48,0.7)', background: '#3a3730',
                  color: '#f7f2e8', fontSize: 12.5, fontFamily: 'inherit',
                },
              }, '保存'),
              h('button', {
                key: 'del',
                onClick: () => {
                  setEditingGuide(false)
                  setGuideHidden(true)
                  try { window.localStorage.setItem(GUIDE_HIDDEN_KEY, '1') } catch { /* ignore */ }
                },
                style: {
                  height: 36, padding: '0 16px', borderRadius: 9, cursor: 'pointer', marginLeft: 'auto',
                  border: '1px solid rgba(184,96,86,0.35)', background: 'transparent',
                  color: '#a8534a', fontSize: 12.5, fontFamily: 'inherit',
                },
              }, '删除使用指南'),
            ]),
          ]),
        ]) : null,
        opened ? h('div', {
          key: 'note',
          style: {
            position: 'fixed', inset: 0, zIndex: 9997, background: 'rgba(8,9,12,0.78)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
          },
          onClick: () => setOpened(null),
        }, [
          h('div', {
            key: 'card',
            onClick: event => event.stopPropagation(),
            style: {
              position: 'relative', width: 'min(620px, 92vw)', background: V.paper,
              borderRadius: 5, padding: '34px 32px 24px',
              boxShadow: '0 34px 90px rgba(0,0,0,0.6)',
            },
          }, [
            h('div', {
              key: 'tape',
              style: {
                position: 'absolute', top: -11, left: '50%', width: 96, height: 24,
                transform: 'translateX(-50%) rotate(-2.5deg)',
                background: 'linear-gradient(180deg, rgba(232,220,196,0.94), rgba(214,201,172,0.8))',
                boxShadow: '0 1px 4px rgba(0,0,0,0.2), inset 0 0 8px rgba(255,255,255,0.5)',
              },
            }),
            h('textarea', {
              key: 'q',
              value: editText,
              onChange: event => setEditText(event.target.value),
              rows: Math.min(9, Math.max(3, Math.ceil((editText.length || 1) / 26))),
              style: {
                width: '100%', boxSizing: 'border-box', border: 'none', outline: 'none',
                resize: 'vertical', background: 'transparent', padding: 0,
                fontSize: 17, lineHeight: 2.02, color: V.paperInk,
                fontFamily: FONT_SERIF, marginBottom: 16, letterSpacing: '0.01em',
              },
            }),
            h('div', {
              key: 'meta',
              style: { fontSize: 12.5, color: V.paperMuted, marginBottom: 22, lineHeight: 1.7 },
            }, [opened.title, opened.site, shortDate(opened.at)].filter(Boolean).join(' · ')),
            h('div', { key: 'actions', style: { display: 'flex', gap: 10, flexWrap: 'wrap' } }, [
              h('button', {
                key: 'save',
                onClick: () => {
                  const text = editText.trim().slice(0, 600)
                  if (!text) return
                  const next = notes.map(note => (note.id === opened.id ? { ...note, quote: text } : note))
                  setNotes(next)
                  writeNotes(next)
                  setOpened({ ...opened, quote: text })
                  flash('便签已更新')
                },
                disabled: editText.trim() === opened.quote || editText.trim().length === 0,
                style: {
                  height: 36, padding: '0 16px', borderRadius: 9,
                  cursor: editText.trim() === opened.quote ? 'default' : 'pointer',
                  border: '1px solid rgba(58,55,48,0.7)',
                  background: editText.trim() === opened.quote ? 'transparent' : '#3a3730',
                  color: editText.trim() === opened.quote ? 'rgba(58,55,48,0.5)' : '#f7f2e8',
                  fontSize: 12.5, fontFamily: 'inherit',
                },
              }, '保存修改'),
              h('a', {
                key: 'src', href: opened.url, target: '_blank', rel: 'noreferrer',
                style: {
                  height: 36, display: 'inline-flex', alignItems: 'center', padding: '0 16px',
                  borderRadius: 9, border: '1px solid rgba(58,55,48,0.22)', color: V.paperInk,
                  fontSize: 16, textDecoration: 'none',
                },
              }, '原文 ↗'),
              h('button', {
                key: 'del',
                onClick: () => { dropNote(opened.id); setOpened(null) },
                style: {
                  height: 36, padding: '0 16px', borderRadius: 9, cursor: 'pointer', marginLeft: 'auto',
                  border: '1px solid rgba(184,96,86,0.35)', background: 'transparent',
                  color: '#a8534a', fontSize: 16, fontFamily: 'inherit',
                },
              }, '删除便签'),
            ]),
          ]),
        ]) : null,
        zoom ? h(ZoomOverlay, {
          key: 'zoom', src: mapSrc, scale: zoom,
          setScale: setZoom, onClose: () => setZoom(0),
        }) : null,
        toast ? h('div', {
          key: 'toast',
          style: {
            position: 'fixed', bottom: 30, left: '50%', transform: 'translateX(-50%)',
            background: V.surface, color: V.text, fontSize: 12.5,
            padding: '10px 20px', borderRadius: 999, border: `1px solid ${V.border}`,
            zIndex: 10000, boxShadow: '0 12px 34px rgba(0,0,0,0.4)',
          },
        }, toast) : null,
      ])
    }

    function sectionTitle(text) {
      return h('div', {
        key: `t-${text}`,
        style: {
          fontSize: 16, letterSpacing: '0.24em', color: V.faint,
          textTransform: 'uppercase', marginBottom: 14,
        },
      }, text)
    }

    return {
      inject: ['slots', 'layout', 'theme'],
      apply(ctx) {
        const DeskPage = props => h(Desk, { ...props, theme: ctx.theme })
        ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
          name: 'sidebar.panellist', id: 'article-desk', order: 6, label: () => '页间',
        }, Icon))
        ctx.slots.inject('main', () => ctx.slots.register({
          name: 'main', key: 'article-desk',
        }, DeskPage))
      },
    }
  },
})
