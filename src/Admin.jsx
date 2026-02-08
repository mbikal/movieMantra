import { useEffect, useMemo, useState } from 'react'
import { supabase } from './lib/supabaseClient'
import './Admin.css'

const emptyForm = {
  id: null,
  title: '',
  description: '',
  genre: '',
  year: '',
  rating: '',
  runtime: '',
  type: '',
  format: '',
  featured: false,
  tag: '',
  link: '',
  thumbnail: ''
}

const adminPasscode = import.meta.env.VITE_ADMIN_PASSCODE

function Admin() {
  const [unlocked, setUnlocked] = useState(
    () => sessionStorage.getItem('admin_unlocked') === 'true'
  )
  const [passcode, setPasscode] = useState('')
  const [form, setForm] = useState(emptyForm)
  const [movies, setMovies] = useState([])
  const [status, setStatus] = useState('')

  useEffect(() => {
    if (!unlocked) return

    let ignore = false

    async function loadMovies() {
      const { data, error } = await supabase
        .from('movies')
        .select('*')
        .order('created_at', { ascending: false })

      if (!ignore) {
        if (error) {
          setStatus(`Error: ${error.message}`)
        } else {
          setMovies(data ?? [])
          setStatus('')
        }
      }
    }

    loadMovies()

    return () => {
      ignore = true
    }
  }, [unlocked])

  const sortedMovies = useMemo(() => movies, [movies])

  function handleUnlock(event) {
    event.preventDefault()
    if (!adminPasscode) {
      setStatus('Missing VITE_ADMIN_PASSCODE in .env.local')
      return
    }
    if (passcode === adminPasscode) {
      sessionStorage.setItem('admin_unlocked', 'true')
      setUnlocked(true)
      setPasscode('')
      setStatus('')
    } else {
      setStatus('Incorrect passcode')
    }
  }

  function handleChange(event) {
    const { name, value, type, checked } = event.target
    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }))
  }

  function resetForm() {
    setForm(emptyForm)
  }

  async function ensureFeatured(uniqueId) {
    if (!form.featured) return
    await supabase.from('movies').update({ featured: false }).neq('id', uniqueId)
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setStatus('Saving...')

    const payload = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      genre: form.genre.trim() || null,
      year: form.year ? Number(form.year) : null,
      rating: form.rating ? Number(form.rating) : null,
      runtime: form.runtime.trim() || null,
      type: form.type.trim() || null,
      format: form.format.trim() || null,
      featured: form.featured,
      tag: form.tag.trim() || null,
      link: form.link.trim() || null,
      thumbnail: form.thumbnail.trim() || null
    }

    let response

    if (form.id) {
      response = await supabase.from('movies').update(payload).eq('id', form.id)
      await ensureFeatured(form.id)
    } else {
      response = await supabase.from('movies').insert(payload).select().single()
      if (response.data?.id) {
        await ensureFeatured(response.data.id)
      }
    }

    if (response.error) {
      setStatus(`Error: ${response.error.message}`)
      return
    }

    const { data } = await supabase
      .from('movies')
      .select('*')
      .order('created_at', { ascending: false })

    setMovies(data ?? [])
    setStatus('Saved')
    resetForm()
  }

  function handleEdit(movie) {
    setForm({
      id: movie.id,
      title: movie.title ?? '',
      description: movie.description ?? '',
      genre: movie.genre ?? '',
      year: movie.year ?? '',
      rating: movie.rating ?? '',
      runtime: movie.runtime ?? '',
      type: movie.type ?? '',
      format: movie.format ?? '',
      featured: Boolean(movie.featured),
      tag: movie.tag ?? '',
      link: movie.link ?? '',
      thumbnail: movie.thumbnail ?? ''
    })
  }

  async function handleDelete(id) {
    const ok = window.confirm('Delete this movie?')
    if (!ok) return

    const { error } = await supabase.from('movies').delete().eq('id', id)
    if (error) {
      setStatus(`Error: ${error.message}`)
      return
    }

    setMovies((prev) => prev.filter((movie) => movie.id !== id))
    setStatus('Deleted')
  }

  if (!unlocked) {
    return (
      <div className="admin-shell">
        <div className="admin-card">
          <h1>Admin Access</h1>
          <p>Enter the passcode from <code>.env.local</code> to continue.</p>
          <form onSubmit={handleUnlock} className="admin-form">
            <input
              type="password"
              placeholder="Admin passcode"
              value={passcode}
              onChange={(event) => setPasscode(event.target.value)}
            />
            <button type="submit">Unlock</button>
          </form>
          {status && <div className="status">{status}</div>}
        </div>
      </div>
    )
  }

  return (
    <div className="admin-shell">
      <header className="admin-header">
        <div>
          <p className="eyebrow">Admin Panel</p>
          <h1>Movie Library</h1>
        </div>
        <a className="back" href="/">
          ← Back to Home
        </a>
      </header>

      <section className="admin-grid">
        <form className="editor" onSubmit={handleSubmit}>
          <div className="editor-head">
            <h2>{form.id ? 'Edit Movie' : 'Add Movie'}</h2>
            <button type="button" className="ghost" onClick={resetForm}>
              Clear
            </button>
          </div>

          <div className="field">
            <label>Title</label>
            <input name="title" value={form.title} onChange={handleChange} required />
          </div>

          <div className="field">
            <label>Description</label>
            <textarea name="description" value={form.description} onChange={handleChange} rows={4} />
          </div>

          <div className="columns">
            <div className="field">
              <label>Genre</label>
              <input name="genre" value={form.genre} onChange={handleChange} />
            </div>
            <div className="field">
              <label>Year</label>
              <input name="year" value={form.year} onChange={handleChange} />
            </div>
            <div className="field">
              <label>Rating</label>
              <input name="rating" value={form.rating} onChange={handleChange} />
            </div>
          </div>

          <div className="columns">
            <div className="field">
              <label>Runtime</label>
              <input name="runtime" value={form.runtime} onChange={handleChange} />
            </div>
            <div className="field">
              <label>Type</label>
              <input name="type" value={form.type} onChange={handleChange} />
            </div>
            <div className="field">
              <label>Format</label>
              <input name="format" value={form.format} onChange={handleChange} />
            </div>
          </div>

          <div className="columns">
            <div className="field">
              <label>Tag</label>
              <input name="tag" value={form.tag} onChange={handleChange} />
            </div>
            <div className="field">
              <label>Thumbnail URL</label>
              <input name="thumbnail" value={form.thumbnail} onChange={handleChange} />
            </div>
            <div className="field">
              <label>Watch Link</label>
              <input name="link" value={form.link} onChange={handleChange} />
            </div>
          </div>

          <div className="field checkbox">
            <label>
              <input type="checkbox" name="featured" checked={form.featured} onChange={handleChange} />
              Featured
            </label>
          </div>

          <div className="actions">
            <button type="submit" className="primary">
              {form.id ? 'Update Movie' : 'Add Movie'}
            </button>
            {status && <span className="status">{status}</span>}
          </div>
        </form>

        <div className="library">
          <div className="library-head">
            <h2>Library</h2>
            <span>{sortedMovies.length} items</span>
          </div>
          <div className="library-list">
            {sortedMovies.map((movie) => (
              <article key={movie.id} className="library-card">
                <div className="thumb" style={{ backgroundImage: movie.thumbnail ? `url(${movie.thumbnail})` : undefined }} />
                <div className="library-info">
                  <div className="title-row">
                    <h3>{movie.title}</h3>
                    {movie.featured && <span className="pill">Featured</span>}
                  </div>
                  <p>{movie.genre || 'Genre'} • {movie.year || 'Year'} • {movie.rating || 'NR'}</p>
                  <div className="library-actions">
                    <button onClick={() => handleEdit(movie)}>Edit</button>
                    <button className="danger" onClick={() => handleDelete(movie.id)}>Delete</button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}

export default Admin
