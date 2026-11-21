import React, { useEffect, useMemo, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Film, Clapperboard, Tv, Heart, Search, Plus, LogOut, Star, LayoutDashboard, ListVideo, LoaderCircle, X, Pencil, Trash2 } from 'lucide-react';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

const categories = [
  { id: 'all', label: 'All library', icon: LayoutDashboard },
  { id: 'movie', label: 'Movies', icon: Film },
  { id: 'anime', label: 'Anime', icon: Clapperboard },
  { id: 'drama', label: 'Drama & Series', icon: Tv },
  { id: 'wishlist', label: 'Wishlist', icon: Heart }
];
const statuses = [
  ['wishlist','Plan to watch'], ['watching','Watching'], ['completed','Completed'],
  ['on_hold','On hold'], ['dropped','Dropped']
];
const emptyForm = { title:'', category:'movie', status:'wishlist', genre:'', release_year:'', rating:'', poster_url:'', watched_episodes:0, total_episodes:'', notes:'' };

function App() {
  const [session, setSession] = useState(null);
  const [authMode, setAuthMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [active, setActive] = useState('all');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
const [suggestions, setSuggestions] = useState([]);
const [suggestionLoading, setSuggestionLoading] = useState(false);

  
useEffect(() => {
  const title = form.title.trim();
  const apiKey = import.meta.env.VITE_TMDB_API_KEY;

  if (!showForm || editing || title.length < 2 || !apiKey) {
    setSuggestions([]);
    return;
  }

  let cancelled = false;

  const timer = setTimeout(async () => {
    setSuggestionLoading(true);

    try {
      const endpoint = form.category === 'movie'
        ? 'movie'
        : form.category === 'drama'
          ? 'tv'
          : 'multi';

      const url = new URL(`https://api.themoviedb.org/3/search/${endpoint}`);
      url.searchParams.set('api_key', apiKey);
      url.searchParams.set('query', title);
      url.searchParams.set('include_adult', 'false');

      const response = await fetch(url);
      if (!response.ok) throw new Error('TMDB search failed');

      const data = await response.json();
      let results = data.results || [];

      if (form.category === 'anime') {
        results = results.filter(item =>
          (item.media_type === 'tv' || item.media_type === 'movie') &&
          (item.original_language === 'ja' ||
            (item.origin_country || []).includes('JP') ||
            (item.genre_ids || []).includes(16))
        );
      }

      if (!cancelled) setSuggestions(results.slice(0, 6));
    } catch (err) {
      if (!cancelled) setSuggestions([]);
    } finally {
      if (!cancelled) setSuggestionLoading(false);
    }
  }, 450);

  return () => {
    cancelled = true;
    clearTimeout(timer);
  };
}, [form.title, form.category, showForm, editing]);
useEffect(() => {
    if (!supabase) { setLoading(false); return; }
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => { if (session) loadItems(); else { setItems([]); setLoading(false); } }, [session]);

  async function loadItems() {
    setLoading(true); setError('');
    const { data, error } = await supabase.from('watch_items').select('*').order('created_at', { ascending:false });
    if (error) setError(error.message); else setItems(data || []);
    setLoading(false);
  }
  async function authenticate(e) {
    e.preventDefault(); setAuthBusy(true); setError('');
   
const { error } = authMode === 'signup'
  ? await supabase.auth.signUp({ email, password })
  : await supabase.auth.signInWithPassword({ email, password });

    if (error) setError(error.message);
    else if (authMode === 'signup') setError('Account created. Check your email if confirmation is enabled, then sign in.');
    setAuthBusy(false);
  }
  async function logout() { await supabase.auth.signOut(); }
  function openNew() { setEditing(null); setForm(emptyForm); setShowForm(true); }
  function openEdit(item) {
    setEditing(item.id);
    setForm({ ...emptyForm, ...item, genre:(item.genre || []).join(', '), release_year:item.release_year ?? '', rating:item.rating ?? '', total_episodes:item.total_episodes ?? '' });
    setShowForm(true);
  }
  async function saveItem(e) {
    e.preventDefault(); setSaving(true); setError('');
    const payload = {
      title: form.title.trim(), category: form.category, status: form.status,
      genre: form.genre.split(',').map(x=>x.trim()).filter(Boolean),
      release_year: form.release_year ? Number(form.release_year) : null,
      rating: form.rating === '' ? null : Number(form.rating),
      poster_url: form.poster_url.trim() || null,
      watched_episodes: Number(form.watched_episodes || 0),
      total_episodes: form.total_episodes === '' ? null : Number(form.total_episodes),
      notes: form.notes.trim() || null
    };
    const query = editing
      ? supabase.from('watch_items').update(payload).eq('id', editing)
      : supabase.from('watch_items').insert({ ...payload, user_id: session.user.id });
    const { error } = await query;
    if (error) setError(error.message);
    else { setShowForm(false); setForm(emptyForm); setEditing(null); await loadItems(); }
    setSaving(false);
  }
  async function deleteItem(item) {
    if (!confirm(`Delete "${item.title}" from your library?`)) return;
    const { error } = await supabase.from('watch_items').delete().eq('id', item.id);
    if (error) setError(error.message); else await loadItems();
  }

  const visible = useMemo(() => items.filter(item => {
    const matchesCategory = active === 'all' || (active === 'wishlist' ? item.status === 'wishlist' : item.category === active);
    const q = search.toLowerCase();
    const matchesSearch = !q || item.title.toLowerCase().includes(q) || (item.genre || []).join(' ').toLowerCase().includes(q);
    return matchesCategory && matchesSearch && (statusFilter === 'all' || item.status === statusFilter);
  }), [items, active, search, statusFilter]);
  const counts = useMemo(() => ({
    all:items.length, movie:items.filter(x=>x.category==='movie').length,
    anime:items.filter(x=>x.category==='anime').length, drama:items.filter(x=>x.category==='drama').length,
    wishlist:items.filter(x=>x.status==='wishlist').length,
    completed:items.filter(x=>x.status==='completed').length
  }), [items]);

  if (!supabase) return <SetupScreen />;
  if (!session) return <div className="auth-shell"><div className="auth-card"><div className="brand-mark"><Film size={25}/></div><p className="eyebrow">YOUR PERSONAL ENTERTAINMENT UNIVERSE</p><h1>Naimul <span>Watch Lists</span></h1><p className="muted">Keep every movie, anime and drama in one beautiful place.</p><form onSubmit={authenticate}><label>Email address</label><input type="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com"/><label>Password</label><input type="password" minLength="6" required value={password} onChange={e=>setPassword(e.target.value)} placeholder="At least 6 characters"/><button className="primary full" disabled={authBusy}>{authBusy ? 'Please wait…' : authMode==='login' ? 'Sign in' : 'Create account'}</button></form>{error && <p className="notice">{error}</p>}<p className="switch">{authMode==='login' ? "New here?" : "Already have an account?"} <button className="link" onClick={()=>{setAuthMode(authMode==='login'?'signup':'login');setError('')}}>{authMode==='login'?'Create an account':'Sign in'}</button></p><p className="tiny">Your collection is private to your account.</p></div></div>;

  return <div className="app">
    <aside className="sidebar"><div className="brand"><div className="brand-mark"><Film size={22}/></div><div><b>Naimul</b><span>WATCH LISTS</span></div></div><div className="side-label">LIBRARY</div><nav>{categories.map(c=>{const Icon=c.icon;return <button key={c.id} className={active===c.id?'nav-item active':'nav-item'} onClick={()=>{setActive(c.id);setStatusFilter('all')}}><Icon size={18}/><span>{c.label}</span><small>{counts[c.id] ?? ''}</small></button>})}</nav><div className="sidebar-bottom"><div className="profile"><div className="avatar">{session.user.email?.[0]?.toUpperCase()}</div><div className="profile-text"><b>{session.user.email}</b><span>PERSONAL LIBRARY</span></div></div><button className="logout" onClick={logout}><LogOut size={16}/> Sign out</button></div></aside>
    <main className="main"><header className="topbar"><div><p className="eyebrow">YOUR PERSONAL ENTERTAINMENT UNIVERSE</p><h1>Welcome back, Naimul<span>.</span></h1><p className="muted">Your stories, all in one place.</p></div><button className="primary" onClick={openNew}><Plus size={18}/> Add to library</button></header>
      <section className="stats"><Stat icon={<ListVideo/>} label="Total titles" value={counts.all}/><Stat icon={<Star/>} label="Completed" value={counts.completed}/><Stat icon={<Heart/>} label="Wishlist" value={counts.wishlist}/><Stat icon={<Tv/>} label="Anime & drama" value={counts.anime+counts.drama}/></section>
      <section className="toolbar"><div className="section-heading"><div><p className="eyebrow">COLLECTION</p><h2>{categories.find(c=>c.id===active)?.label || 'All library'}</h2></div><span className="result-count">{visible.length} TITLES</span></div><div className="filters"><div className="searchbox"><Search size={17}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search titles or genres…"/></div><select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}><option value="all">All statuses</option>{statuses.map(s=><option key={s[0]} value={s[0]}>{s[1]}</option>)}</select></div></section>
      {error && <div className="notice">{error}</div>}
      {loading ? <div className="loading"><LoaderCircle className="spin"/> Loading your library…</div> : visible.length===0 ? <div className="empty"><div className="empty-icon"><Clapperboard size={28}/></div><h3>Your collection starts here</h3><p>Add your first movie, anime or drama. You can keep wishlisted titles here too.</p><button className="primary" onClick={openNew}><Plus size={17}/> Add your first title</button></div> : <div className="grid">{visible.map(item=><article className="item-card" key={item.id}><div className="poster">{item.poster_url ? <img src={item.poster_url} alt={item.title} onError={e=>{e.currentTarget.style.display='none'}}/> : <div className="poster-placeholder"><Film size={32}/><span>{item.category.toUpperCase()}</span></div>}<span className="status-pill">{statuses.find(s=>s[0]===item.status)?.[1]}</span><div className="card-actions"><button onClick={()=>openEdit(item)} aria-label="Edit"><Pencil size={15}/></button><button onClick={()=>deleteItem(item)} aria-label="Delete"><Trash2 size={15}/></button></div></div><div className="item-info"><div className="item-top"><span className="category">{item.category}</span>{item.release_year && <span>{item.release_year}</span>}</div><h3>{item.title}</h3><div className="genres">{(item.genre||[]).slice(0,3).join(' · ') || 'No genres added'}</div>{item.rating!=null && <div className="rating"><Star size={14} fill="currentColor"/> {Number(item.rating).toFixed(1)} <span>/ 10</span></div>}{item.category!=='movie' && item.total_episodes && <div className="progress"><div><span>Episodes</span><b>{item.watched_episodes}/{item.total_episodes}</b></div><div className="track"><i style={{width:`${Math.min(100,100*item.watched_episodes/item.total_episodes)}%`}}/></div></div>}</div></article>)}</div>}
    </main>
    {showForm && <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setShowForm(false)}}><form className="modal" onSubmit={saveItem}><div className="modal-head"><div><p className="eyebrow">LIBRARY ENTRY</p><h2>{editing?'Edit title':'Add a title'}</h2></div><button type="button" className="icon-btn" onClick={()=>setShowForm(false)}><X/></button></div><label>Title *</label>
<input
  required
  autoFocus
  value={form.title}
  onChange={e => setForm({...form, title:e.target.value})}
  placeholder="Search a movie, anime or drama..."
/>

{suggestionLoading && (
  <p className="tiny">Searching online...</p>
)}

{suggestions.length > 0 && (
  <div style={{
    background:'#211d30',
    border:'1px solid #51436b',
    borderRadius:12,
    marginTop:8,
    overflow:'hidden'
  }}>
    {suggestions.map(item => {
      const name = item.title || item.name;
      const date = item.release_date || item.first_air_date || '';
      const genres = {
        12:'Adventure', 14:'Fantasy', 16:'Animation',
        18:'Drama', 27:'Horror', 28:'Action',
        35:'Comedy', 36:'History', 37:'Western',
        53:'Thriller', 80:'Crime', 878:'Sci-Fi',
        9648:'Mystery', 10749:'Romance',
        10751:'Family', 10759:'Action & Adventure',
        10765:'Sci-Fi & Fantasy', 10766:'Soap',
        10768:'War & Politics'
      };

      return (
        <button
          type="button"
          key={`${item.media_type}-${item.id}`}
          onClick={() => {
            setForm(prev => ({
              ...prev,
              title: name,
              release_year: date ? date.slice(0,4) : '',
              poster_url: item.poster_path
                ? `https://image.tmdb.org/t/p/w500${item.poster_path}`
                : '',
              genre: (item.genre_ids || [])
                .map(id => genres[id])
                .filter(Boolean)
                .join(', ')
            }));
            setSuggestions([]);
          }}
          style={{
            display:'flex',
            alignItems:'center',
            gap:12,
            width:'100%',
            padding:10,
            background:'transparent',
            color:'white',
            border:0,
            borderBottom:'1px solid #40364f',
            textAlign:'left',
            cursor:'pointer'
          }}
        >
          {item.poster_path ? (
            <img
              src={`https://image.tmdb.org/t/p/w92${item.poster_path}`}
              alt=""
              style={{
                width:42,
                height:60,
                objectFit:'cover',
                borderRadius:5
              }}
            />
          ) : (
            <div style={{width:42,height:60}}>🎬</div>
          )}
          <span>
            <b>{name}</b>
            <br/>
            <small style={{color:'#b7a9c9'}}>
              {date ? date.slice(0,4) : 'Year unknown'}
              {' · '}
              {item.media_type === 'tv' ? 'TV Series' : 'Movie'}
            </small>
          </span>
        </button>
      );
    })}
  </div>
)}
<div className="form-row"><div><label>Category</label><select value={form.category} onChange={e=>setForm({...form,category:e.target.value})}><option value="movie">Movie</option><option value="anime">Anime</option><option value="drama">Drama / Series</option></select></div><div><label>Status</label><select value={form.status} onChange={e=>setForm({...form,status:e.target.value})}>{statuses.map(s=><option key={s[0]} value={s[0]}>{s[1]}</option>)}</select></div></div><div className="form-row"><div><label>Release year</label><input type="number" min="1888" max="2100" value={form.release_year} onChange={e=>setForm({...form,release_year:e.target.value})} placeholder="2026"/></div><div><label>Your rating (0–10)</label><input type="number" min="0" max="10" step="0.1" value={form.rating} onChange={e=>setForm({...form,rating:e.target.value})} placeholder="8.5"/></div></div><label>Genres (comma separated)</label><input value={form.genre} onChange={e=>setForm({...form,genre:e.target.value})} placeholder="Sci-fi, Drama, Thriller"/><label>Poster image URL (optional)</label><input type="url" value={form.poster_url} onChange={e=>setForm({...form,poster_url:e.target.value})} placeholder="https://…"/>{form.category!=='movie' && <div className="form-row"><div><label>Episodes watched</label><input type="number" min="0" value={form.watched_episodes} onChange={e=>setForm({...form,watched_episodes:e.target.value})}/></div><div><label>Total episodes</label><input type="number" min="1" value={form.total_episodes} onChange={e=>setForm({...form,total_episodes:e.target.value})} placeholder="24"/></div></div>}<label>Notes (optional)</label><textarea rows="3" value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} placeholder="Your thoughts…"/><div className="modal-footer"><button type="button" className="secondary" onClick={()=>setShowForm(false)}>Cancel</button><button className="primary" disabled={saving}>{saving?'Saving…':editing?'Save changes':'Add to library'}</button></div></form></div>}
  </div>;
}
function Stat({icon,label,value}) { return <div className="stat"><div className="stat-icon">{icon}</div><div><span>{label}</span><b>{value}</b></div></div> }
function SetupScreen() { return <div className="auth-shell"><div className="auth-card setup"><div className="brand-mark"><Film/></div><p className="eyebrow">ONE QUICK SETUP STEP</p><h1>Connect your <span>library</span></h1><p className="muted">Add your Supabase project details to the local environment file.</p><ol><li>Rename <code>.env.example</code> to <code>.env</code>.</li><li>Set <code>VITE_SUPABASE_URL</code> to your project URL.</li><li>Set <code>VITE_SUPABASE_PUBLISHABLE_KEY</code> to your <b>publishable</b> key.</li><li>Restart the app with <code>npm run dev</code>.</li></ol><p className="tiny">Never put a Supabase secret key or database password in frontend code.</p></div></div> }
export default App;