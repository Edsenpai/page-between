// One model call for the desk page: the profile's default model, no key
// management, no streaming to the browser.

/**
 * Read the profile's current default model selection.
 *
 * @param {object} ctx Cordis context.
 * @returns {{ provider: string, model: string } | undefined}
 */
export function currentModel(ctx) {
  try {
    const selection = ctx.get('agentDefaultModel')?.currentSelection()
    const llm = ctx.get('llm')
    if (llm === undefined || !selection?.provider || !selection?.model) return undefined
    return { provider: selection.provider, model: selection.model }
  } catch {
    return undefined
  }
}

/**
 * Call the default model once and return the whole text.
 *
 * @param {object} ctx Cordis context.
 * @param {{ system: string, user: string, maxTokens?: number, timeoutMs?: number, source?: string }} request
 * @returns {Promise<{ text: string, model: string }>}
 */
export async function callText(ctx, request) {
  const info = currentModel(ctx)
  if (info === undefined) throw new Error('当前没有可用的默认模型')
  const llm = ctx.get('llm')
  const maxTokens = request.maxTokens ?? 3000
  const timeout = AbortSignal.timeout(request.timeoutMs ?? 120_000)

  const call = await llm.prepareCall({ provider: info.provider, model: info.model, maxTokens }, timeout, controls => controls)

  let text = ''
  let usage
  for await (const chunk of call.stream({
    ...call.config,
    system: request.system,
    messages: [{
      role: 'user',
      content: [{ type: 'text', text: request.user }],
      source: { kind: request.source ?? 'article-desk' },
    }],
    signal: timeout,
  })) {
    if (chunk.usage !== undefined && chunk.usage !== null) usage = chunk.usage
    if (chunk.type === 'text-delta') {
      text += chunk.text
    } else if (chunk.type === 'finish') {
      if (chunk.usage !== undefined && chunk.usage !== null) usage = chunk.usage
      if (['error', 'aborted'].includes(chunk.reason?.kind)) {
        throw new Error(chunk.reason.failure?.message || '模型调用失败')
      }
    }
  }
  return { text, model: info.model, usage: normalizeUsage(usage) }
}

/**
 * Keep only the numeric fields a usage report can carry.
 *
 * @param {unknown} usage provider usage object.
 * @returns {{ input: number, output: number, total: number } | undefined}
 */
function normalizeUsage(usage) {
  if (usage === null || typeof usage !== 'object') return undefined
  const pick = (...keys) => {
    for (const key of keys) {
      const value = usage[key]
      if (typeof value === 'number' && Number.isFinite(value) && value >= 0) return value
    }
    return undefined
  }
  const input = pick('inputTokens', 'input_tokens', 'promptTokens', 'prompt_tokens', 'input')
  const output = pick('outputTokens', 'output_tokens', 'completionTokens', 'completion_tokens', 'output')
  const total = pick('totalTokens', 'total_tokens', 'total') ?? ((input ?? 0) + (output ?? 0) || undefined)
  if (total === undefined) return undefined
  return { input: input ?? 0, output: output ?? 0, total }
}

/**
 * Pull the first JSON object/array out of a model reply, tolerating fences,
 * prose around it, trailing commas, and stray control characters.
 *
 * @param {string} text raw model text.
 * @returns {unknown}
 */
export function extractJson(text) {
  const source = String(text ?? '')
  const candidates = []

  // Every fenced block, last first: models often put the answer last.
  const fences = [...source.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi)].map(match => match[1])
  candidates.push(...fences.reverse())
  candidates.push(source)

  // Any top-level object slice in the raw text.
  const first = source.indexOf('{')
  const last = source.lastIndexOf('}')
  if (first >= 0 && last > first) candidates.push(source.slice(first, last + 1))

  const cleanups = [
    body => body,
    body => body.replace(/,\s*([}\]])/g, '$1'),
    body => body.replace(/,\s*([}\]])/g, '$1').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, ''),
  ]

  for (const candidate of candidates) {
    const trimmed = String(candidate).trim()
    if (!trimmed) continue
    for (const cleanup of cleanups) {
      try {
        const parsed = JSON.parse(cleanup(trimmed))
        if (parsed && typeof parsed === 'object') return parsed
      } catch {
        // try the next repair
      }
    }
  }
  throw new Error('模型没有返回可解析的 JSON')
}
