import { useEffect, useState } from 'react'
import { supabase } from './lib/supabaseClient'
import './Search.css'

function getQuery() {
  const params = new URLSearchParams(window.location.search)
  return params.get('q') ?? ''
}

function Search() {
  const [status, setStatus] = useState('')
  const [query, setQuery] = useState(getQuery())
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let ignore = false
    const trimmed = query.trim()

    if (!trimmed) {
      setResults([])
      setStatus('')
      return () => {
        ignore = true
      }
    }

    const timer = setTimeout(async () => {
      setLoading(true)
      const { data, error } = await supabase
        .from('movies')
        .select('*')
        .or(
          `title.ilike.%${trimmed}%,genre.ilike.%${trimmed}%,description.ilike.%${trimmed}%,type.ilike.%${trimmed}%,format.ilike.%${trimmed}%`
        )
        .order('created_at', { ascending: false })
        .limit(40)

      if (!ignore) {
        if (error) {
          setStatus(`Error: ${error.message}`)
          setResults([])
        } else {
          setResults(data ?? [])
          setStatus('')
        }
        setLoading(false)
      }
    }, 250)

    return () => {
      ignore = true
      clearTimeout(timer)
    }
  }, [query])

  useEffect(() => {
    const handlePop = () => setQuery(getQuery())
    window.addEventListener('popstate', handlePop)
    return () => window.removeEventListener('popstate', handlePop)
  }, [])

  function handleSearch(event) {
    event.preventDefault()
    const trimmed = query.trim()
    window.history.pushState({}, '', `/search?q=${encodeURIComponent(trimmed)}`)
    setQuery(trimmed)
  }

  return (
    <div className="search-shell">
      <header className="search-topbar">
        <button className="back" onClick={() => (window.location.href = '/')}>
          ← Back
        </button>
        <form className="search-box" onSubmit={handleSearch}>
          <span>🔍</span>
          <input
            placeholder="Search titles, genres"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <button type="submit">Search</button>
        </form>
      </header>

      {status && <div className="status-banner">{status}</div>}

      <main className="search-results">
        <div className="results-head">
          <h1>Search results</h1>
          <span>
            {query ? `${results.length} results` : 'Enter a keyword'}
          </span>
        </div>
        {loading && <div className="loading">Searching...</div>}
        {query && results.length === 0 && !status && !loading && (
          <div className="empty">No results for "{query}"</div>
        )}
        <div className="results-grid">
          {results.map((movie) => (
            <button
              key={movie.id}
              className="result-card"
              onClick={() => {
                window.location.href = `/watch?id=${movie.id}`
              }}
            >
              <div
                className="poster"
                style={{ backgroundImage: movie.thumbnail ? `url(${movie.thumbnail})` : undefined }}
              />
              <div className="info">
                <h3>{movie.title}</h3>
                <p>{movie.genre ?? 'Genre'} • {movie.year ?? 'Year'} • {movie.rating ?? 'NR'}</p>
              </div>
            </button>
          ))}
        </div>
      </main>
    </div>
  )
}

export default Search
