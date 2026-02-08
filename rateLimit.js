const rateLimit = ({ windowMs, max }) => {
  const hits = new Map()

  return (req, res, next) => {
    const now = Date.now()
    const key = req.ip || 'global'
    const entry = hits.get(key) || { count: 0, start: now }

    if (now - entry.start > windowMs) {
      entry.count = 0
      entry.start = now
    }

    entry.count += 1
    hits.set(key, entry)

    if (entry.count > max) {
      return res.status(429).json({ error: 'Too many requests' })
    }

    next()
  }
}

export default rateLimit
