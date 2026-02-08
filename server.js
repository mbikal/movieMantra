import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import movies from './movies.js'
import rateLimit from './rateLimit.js'
import { pipeline } from 'node:stream'
import { promisify } from 'node:util'

const pump = promisify(pipeline)

dotenv.config()

const app = express()
const PORT = process.env.PORT || 4000
const TERABOX_NDUS = process.env.TERABOX_NDUS || ''
const TERABOX_RESOLVER_URL = process.env.TERABOX_RESOLVER_URL || ''
const ALLOWED_PROXY_HOSTS = (process.env.ALLOWED_PROXY_HOSTS || '')
  .split(',')
  .map((entry) => entry.trim())
  .filter(Boolean)
const ALLOW_PROXY_ANY = process.env.ALLOW_PROXY_ANY === 'true'

app.use(cors())
app.use(express.json())

app.get('/health', (_req, res) => {
  res.json({ ok: true })
})

app.get('/api/movies', (_req, res) => {
  const list = movies.map(({ id, title, year }) => ({
    id,
    title,
    year,
    streamEndpoint: `/api/stream/${id}`
  }))
  res.json(list)
})

app.get('/api/movies/:id', (req, res) => {
  const movie = movies.find((item) => item.id === req.params.id)
  if (!movie) {
    return res.status(404).json({ error: 'Movie not found' })
  }
  res.json(movie)
})

function isTeraboxShare(url) {
  try {
    const host = new URL(url).hostname.toLowerCase()
    return host.includes('terabox') || host.includes('1024terabox')
  } catch {
    return false
  }
}

function isLikelyHls(url, contentType) {
  if (contentType && contentType.includes('application/vnd.apple.mpegurl')) return true
  if (!url) return false
  return url.toLowerCase().includes('.m3u8')
}

function isHostAllowed(targetUrl, baseHost) {
  if (ALLOW_PROXY_ANY || ALLOWED_PROXY_HOSTS.length === 0) return true
  try {
    const host = new URL(targetUrl).hostname.toLowerCase()
    if (baseHost && host === baseHost) return true
    const allowedHosts = new Set(
      [...ALLOWED_PROXY_HOSTS, baseHost].filter(Boolean).map((entry) => entry.toLowerCase())
    )
    return Array.from(allowedHosts).some((allowed) => host === allowed || host.endsWith(`.${allowed}`))
  } catch {
    return false
  }
}

async function resolveTeraboxUrl(inputUrl, signal) {
  if (!isTeraboxShare(inputUrl)) {
    return { url: inputUrl, resolved: false, source: 'direct' }
  }

  if (TERABOX_NDUS) {
    const resolverUrl = `https://nord.teraboxfast.com/?ndus=${encodeURIComponent(
      TERABOX_NDUS
    )}&url=${encodeURIComponent(inputUrl)}`
    const response = await fetch(resolverUrl, { signal })
    if (!response.ok) {
      throw new Error(`Resolver error (${response.status})`)
    }
    const data = await response.json()
    const directLink = data?.direct_link || data?.link || data?.url
    if (!directLink) {
      throw new Error('Resolver response missing direct link')
    }
    return { url: directLink, resolved: true, source: 'teraboxfast' }
  }

  if (TERABOX_RESOLVER_URL) {
    const joiner = TERABOX_RESOLVER_URL.includes('?') ? '&' : '?'
    const resolverUrl = `${TERABOX_RESOLVER_URL}${joiner}url=${encodeURIComponent(inputUrl)}`
    const response = await fetch(resolverUrl, { signal })
    if (!response.ok) {
      throw new Error(`Resolver error (${response.status})`)
    }
    const data = await response.json()
    const directLink =
      data?.direct_link ||
      data?.link ||
      data?.url ||
      data?.data?.direct_link ||
      data?.data?.url
    if (!directLink) {
      throw new Error('Resolver response missing direct link')
    }
    return { url: directLink, resolved: true, source: 'custom' }
  }

  throw new Error('No TeraBox resolver configured')
}

async function handleStream(req, res, targetUrl) {
  const range = req.headers.range
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15_000)

  try {
    const upstreamResponse = await fetch(targetUrl, {
      method: 'GET',
      headers: range ? { Range: range } : {},
      redirect: 'follow',
      signal: controller.signal
    })

    const contentType = upstreamResponse.headers.get('content-type') || ''

    if (contentType.includes('text/html')) {
      res.status(400).json({
        error: 'Provided link is not a direct video file URL. Use a direct MP4/HLS URL.'
      })
      return
    }

    if (isLikelyHls(targetUrl, contentType)) {
      const playlistText = await upstreamResponse.text()
      const baseUrl = new URL(targetUrl)
      const rewritten = playlistText
        .split('\n')
        .map((line) => {
          const trimmed = line.trim()
          if (!trimmed || trimmed.startsWith('#')) return line
          const absolute = new URL(trimmed, baseUrl).toString()
          if (!isHostAllowed(absolute, baseUrl.hostname)) {
            throw new Error('Segment host not allowed by proxy')
          }
          return `/api/stream?url=${encodeURIComponent(absolute)}`
        })
        .join('\n')

      res.status(200)
      res.setHeader('Content-Type', 'application/vnd.apple.mpegurl')
      res.setHeader('Cache-Control', 'no-cache')
      res.send(rewritten)
      return
    }

    res.setHeader('Accept-Ranges', 'bytes')

    const contentLength = upstreamResponse.headers.get('content-length')
    const contentRange = upstreamResponse.headers.get('content-range')

    if (range && contentRange) {
      res.status(206)
      res.setHeader('Content-Range', contentRange)
      if (contentLength) {
        res.setHeader('Content-Length', contentLength)
      }
    } else {
      res.status(200)
      if (contentLength) {
        res.setHeader('Content-Length', contentLength)
      }
    }

    res.setHeader('Content-Type', contentType || 'application/octet-stream')

    if (!upstreamResponse.body) {
      res.status(502).json({ error: 'Upstream response has no body' })
      return
    }

    await pump(upstreamResponse.body, res)
  } catch (error) {
    if (error.name === 'AbortError') {
      res.status(504).json({ error: 'Upstream request timed out' })
      return
    }
    res.status(502).json({ error: error.message || 'Failed to stream video' })
  } finally {
    clearTimeout(timeout)
  }
}

app.post('/api/resolve', rateLimit({ windowMs: 60_000, max: 60 }), async (req, res) => {
  const { url } = req.body || {}
  if (!url) {
    return res.status(400).json({ error: 'Missing url' })
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15_000)

  try {
    const result = await resolveTeraboxUrl(url, controller.signal)
    res.json(result)
  } catch (error) {
    res.status(400).json({ error: error.message || 'Failed to resolve link' })
  } finally {
    clearTimeout(timeout)
  }
})

app.get('/api/stream', rateLimit({ windowMs: 60_000, max: 60 }), async (req, res) => {
  const targetUrl = req.query.url
  if (!targetUrl || typeof targetUrl !== 'string') {
    return res.status(400).json({ error: 'Missing url query parameter' })
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15_000)

  try {
    const result = await resolveTeraboxUrl(targetUrl, controller.signal)
    const resolvedUrl = result.url
    if (!isHostAllowed(resolvedUrl, new URL(resolvedUrl).hostname)) {
      return res.status(400).json({ error: 'Resolved host not allowed by proxy' })
    }
    await handleStream(req, res, resolvedUrl)
  } catch (error) {
    if (error.name === 'AbortError') {
      res.status(504).json({ error: 'Upstream request timed out' })
      return
    }
    res.status(400).json({ error: error.message || 'Failed to stream video' })
  } finally {
    clearTimeout(timeout)
  }
})

app.get('/api/stream/:id', rateLimit({ windowMs: 60_000, max: 60 }), async (req, res) => {
  const movie = movies.find((item) => item.id === req.params.id)
  if (!movie) {
    return res.status(404).json({ error: 'Movie not found' })
  }

  await handleStream(req, res, movie.remoteUrl)
})

app.use((err, _req, res, _next) => {
  res.status(500).json({ error: err.message || 'Internal server error' })
})

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Server running on http://localhost:${PORT}`)
})
