import { useEffect, useMemo, useState } from 'react'
import { supabase } from './lib/supabaseClient'
import './App.css'

function App() {
  const [movies, setMovies] = useState([])
  const [status, setStatus] = useState('')
  const [query, setQuery] = useState('')
  const [selectedGenre, setSelectedGenre] = useState('All')
  const [browseOpen, setBrowseOpen] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let ignore = false

    async function loadMovies() {
      setLoading(true)
      const { data, error } = await supabase
        .from('movies')
        .select('*')
        .order('created_at', { ascending: false })

      if (!ignore) {
        if (error) {
          setStatus(`Error: ${error.message}`)
          setMovies([])
        } else {
          setMovies(data ?? [])
          setStatus('')
        }
        setLoading(false)
      }
    }

    loadMovies()

    return () => {
      ignore = true
    }
  }, [])

  const availableGenres = useMemo(() => {
    const baseGenres = [
      'Action',
      'Comedy',
      'Drama',
      'Horror',
      'Horror Comedy',
      'Thriller',
      'Rom Com'
    ]
    const set = new Set(baseGenres)
    movies.forEach((movie) => {
      if (movie.genre) set.add(movie.genre)
    })
    return ['All', ...Array.from(set).sort()]
  }, [movies])

  const filteredMovies = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return movies.filter((movie) => {
      const matchesQuery =
        !needle ||
        movie.title?.toLowerCase().includes(needle) ||
        movie.genre?.toLowerCase().includes(needle) ||
        movie.description?.toLowerCase().includes(needle) ||
        movie.type?.toLowerCase().includes(needle) ||
        movie.format?.toLowerCase().includes(needle)

      const matchesGenre =
        selectedGenre === 'All' ||
        movie.genre?.toLowerCase() === selectedGenre.toLowerCase()

      return matchesQuery && matchesGenre
    })
  }, [movies, query, selectedGenre])

  const content = useMemo(() => {
    const source = filteredMovies
    if (!source.length) {
      return { featured: null, sidebar: [], trending: [] }
    }

    const featured = source.find((movie) => movie.featured) ?? source[0]
    const sidebar = source.slice(0, 3)
    const trending = source.slice(0, 7)

    return { featured, sidebar, trending }
  }, [filteredMovies])

  const featured = content.featured
  const featuredId = featured?.id

  return (
    <div className="shell">
      <header className="topbar">
        <div className="logo">B</div>
        <div className="browse-wrap">
          <button
            className="browse"
            onClick={() => setBrowseOpen((prev) => !prev)}
          >
            ☰ Browse
          </button>
          {browseOpen && (
            <div className="browse-panel">
              <p>Genres</p>
              <div className="genre-list">
                {availableGenres.map((genre) => (
                  <button
                    key={genre}
                    className={`genre-pill ${selectedGenre === genre ? 'active' : ''}`}
                    onClick={() => {
                      setSelectedGenre(genre)
                      setBrowseOpen(false)
                    }}
                  >
                    {genre}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        <form
          className="search"
          onSubmit={(event) => {
            event.preventDefault()
            const trimmed = query.trim()
            if (trimmed) {
              window.location.href = `/search?q=${encodeURIComponent(trimmed)}`
            }
          }}
        >
          <span>🔍</span>
          <input
            placeholder="Enter keywords..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </form>
        <div className="spacer" />
      </header>

      <main className="content">
        {(status ||
          (query && !filteredMovies.length) ||
          (!loading && !movies.length && !status)) && (
          <div className="status-banner">
            {status ||
              (query && !filteredMovies.length
                ? `No results for "${query}"`
                : 'No movies found. Add titles in the admin panel.')}
          </div>
        )}

        <section className="hero">
          <div className="hero-media">
            <button className="arrow left">‹</button>
            <button className="arrow right">›</button>
            <div className="hero-overlay">
              <div
                className="poster"
                style={{
                  backgroundImage: featured?.thumbnail ? `url(${featured.thumbnail})` : undefined
                }}
              />
              <div className="hero-info">
                <button
                  className="play"
                  onClick={() => {
                    if (featuredId) {
                      window.location.href = `/watch?id=${featuredId}`
                    }
                  }}
                >
                  ▶
                </button>
                <h1>{featured?.title ?? 'No movie selected'}</h1>
                <div className="meta">
                  <span className="star">★</span>
                  <span>{featured?.rating ?? 'NR'}</span>
                  <span className="dot">•</span>
                  <span>{featured?.format ?? 'HD'}</span>
                </div>
                <p>{featured?.description ?? 'Add a movie in the admin panel to populate this section.'}</p>
              </div>
            </div>
          </div>

          <aside className="sidebar">
            <div className="sidebar-head">
              <span>Share with</span>
            </div>
            <div className="sidebar-list">
              {content.sidebar.map((item) => (
                <article key={item.id ?? item.title} className="side-card">
                  <div
                    className="thumb"
                    style={{ backgroundImage: item.thumbnail ? `url(${item.thumbnail})` : undefined }}
                  />
                  <div className="side-info">
                    <div className="meta small">
                      <span className="star">★</span>
                      <span>{item.rating ?? 'NR'}</span>
                      <span className="dot">•</span>
                      <span>{item.format ?? 'HD'}</span>
                    </div>
                    <h3>{item.title}</h3>
                    <p>{item.description}</p>
                    <button
                      className="watch"
                      onClick={() => {
                        if (item.id) {
                          window.location.href = `/watch?id=${item.id}`
                        }
                      }}
                    >
                      ▶ Watch now
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </aside>
        </section>

        <div className="ad">Watch Movies Online FREE — No Ads · No Buffering</div>

        <section className="trending">
          <div className="trend-head">
            <div className="trend-title">
              <span className="bar" />
              <h2>Trending</h2>
            </div>
            <div className="trend-tabs">
              <button className="tab active">Movies</button>
              <button className="tab">TV Shows</button>
            </div>
          </div>
          <div className="trend-grid">
            {content.trending.map((item) => (
              <article key={item.id ?? item} className="trend-card">
                <div
                  className="trend-poster"
                  style={{ backgroundImage: item.thumbnail ? `url(${item.thumbnail})` : undefined }}
                />
                <p>{item.title ?? item}</p>
              </article>
            ))}
          </div>
        </section>
      </main>
    </div>
  )
}

export default App
