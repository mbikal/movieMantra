import { useEffect, useMemo, useState } from 'react'
import { supabase } from './lib/supabaseClient'
import './Watch.css'

function getQueryId() {
  const params = new URLSearchParams(window.location.search)
  return params.get('id')
}

function Watch() {
  const [movie, setMovie] = useState(null)
  const [movies, setMovies] = useState([])
  const [status, setStatus] = useState('')
  const streamBaseUrl = (import.meta.env.VITE_STREAM_BASE_URL || '').replace(/\/$/, '')
  const forceProxy = import.meta.env.VITE_STREAM_FORCE_PROXY !== 'false'

  useEffect(() => {
    let ignore = false
    const movieId = getQueryId()

    async function load() {
      const { data, error } = await supabase
        .from('movies')
        .select('*')
        .order('created_at', { ascending: false })

      if (!ignore) {
        if (error) {
          setStatus(`Error: ${error.message}`)
          setMovies([])
          setMovie(null)
          return
        }

        setMovies(data ?? [])
        if (movieId) {
          const selected = (data ?? []).find((item) => item.id === movieId)
          setMovie(selected ?? null)
        } else {
          setMovie((data ?? [])[0] ?? null)
        }
      }
    }

    load()

    return () => {
      ignore = true
    }
  }, [])

  const related = useMemo(() => {
    if (!movies.length) return []
    return movies.filter((item) => item.id !== movie?.id).slice(0, 8)
  }, [movies, movie])

  const mediaSrc = useMemo(() => {
    if (!movie?.link) return ''
    if (movie.link.startsWith('http://') || movie.link.startsWith('https://')) {
      return movie.link
    }
    return `https://${movie.link}`
  }, [movie])

  const videoSrc = useMemo(() => {
    if (!mediaSrc) return ''
    if (!streamBaseUrl || !forceProxy) return mediaSrc
    return `${streamBaseUrl}/api/stream?url=${encodeURIComponent(mediaSrc)}`
  }, [mediaSrc, streamBaseUrl, forceProxy])

  return (
    <div className="watch-shell">
      <header className="watch-topbar">
        <button
          className="back"
          onClick={() => {
            window.location.href = '/'
          }}
        >
          ← Back
        </button>
        <div className="watch-title">
          <h1>{movie?.title ?? 'Select a movie'}</h1>
          <p>
            {movie?.genre ?? 'Genre'} • {movie?.year ?? 'Year'} • {movie?.rating ?? 'NR'}
          </p>
        </div>
      </header>

      {status && <div className="status-banner">{status}</div>}

      <main className="watch-grid">
        <section className="player">
          {videoSrc ? (
            <video
              key={videoSrc}
              src={videoSrc}
              controls
              playsInline
            />
          ) : (
            <div className="player-placeholder">
              <div>
                <p>No streaming link set</p>
                <span>Add a `link` in the admin panel to enable playback.</span>
              </div>
            </div>
          )}
          <div className="movie-info">
            <div>
              <h2>About</h2>
              <p>{movie?.description ?? 'No description available yet.'}</p>
            </div>
            <div className="details">
              <div>
                <span>Format</span>
                <strong>{movie?.format ?? 'HD'}</strong>
              </div>
              <div>
                <span>Runtime</span>
                <strong>{movie?.runtime ?? '—'}</strong>
              </div>
              <div>
                <span>Type</span>
                <strong>{movie?.type ?? 'Film'}</strong>
              </div>
            </div>
          </div>
        </section>

        <aside className="related">
          <div className="related-head">
            <h2>Related</h2>
            <span>{related.length} titles</span>
          </div>
          <div className="related-list">
            {related.map((item) => (
              <button
                key={item.id}
                className="related-card"
                onClick={() => {
                  window.location.href = `/watch?id=${item.id}`
                }}
              >
                <div
                  className="thumb"
                  style={{ backgroundImage: item.thumbnail ? `url(${item.thumbnail})` : undefined }}
                />
                <div>
                  <p>{item.title}</p>
                  <span>{item.genre ?? 'Genre'} • {item.year ?? 'Year'}</span>
                </div>
              </button>
            ))}
          </div>
        </aside>
      </main>
    </div>
  )
}

export default Watch
