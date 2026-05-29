import { useEffect, useMemo, useState } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  Gamepad2,
  Home,
  Loader2,
  Minus,
  Plus,
  Search,
  ShoppingCart,
  SlidersHorizontal,
  Trash2,
  X,
} from 'lucide-react'

const PAGE_SIZE = 30
const RAWG_API = 'https://api.rawg.io/api/games'
const GAME_LIST_URL = '/juegos.txt'
const CART_STORAGE_KEY = 'juegos-menu-cart'
const PREFERENCES_STORAGE_KEY = 'juegos-menu-preferences'
const WHATSAPP_URL = 'https://wa.me/+573142784403'
const DEMO_GAMES = [
  'Elden Ring',
  'Grand Theft Auto V',
  'Cyberpunk 2077',
  'The Witcher 3',
  'Red Dead Redemption 2',
  'God of War',
  'Hades',
  'Hollow Knight',
  'Minecraft',
  'Stardew Valley',
  'Resident Evil 4',
  'Baldur Gate 3',
  'Forza Horizon 5',
  'Celeste',
  'Sea of Stars',
  'Spider-Man',
  'Doom Eternal',
  'The Last of Us',
  'Ghost of Tsushima',
  'Sekiro',
  'Cuphead',
  'Portal 2',
  'Dark Souls III',
  'Fallout 4',
  'Diablo IV',
  'Mortal Kombat 1',
  'Street Fighter 6',
  'FIFA 26',
  'NBA 2K26',
  'Among Us',
].map((name, index) => ({
  id: `demo-${index + 1}`,
  name,
  background_image: `https://picsum.photos/seed/juego-${index + 1}/640/480`,
}))

const readStorage = (key, fallback) => {
  try {
    const value = window.localStorage.getItem(key)
    return value ? JSON.parse(value) : fallback
  } catch {
    return fallback
  }
}

const cleanGameTitle = (title) =>
  title
    .replace(/\s*\([^)]*\)/g, '')
    .replace(/\s+/g, ' ')
    .trim()

const parseGameList = (text) => {
  const seen = new Set()

  return text
    .split(/\r?\n/)
    .map(cleanGameTitle)
    .filter((title) => title && !/^columna derecha$/i.test(title))
    .filter((title) => {
      const key = title.toLowerCase()
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
}

const gameImage = (game) =>
  game.background_image ||
  'https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=900&q=80'

function App() {
  const [route, setRoute] = useState(() => window.location.pathname)
  const [preferences, setPreferences] = useState(() =>
    readStorage(PREFERENCES_STORAGE_KEY, { page: 1 }),
  )
  const [cart, setCart] = useState(() => readStorage(CART_STORAGE_KEY, []))
  const [gameNames, setGameNames] = useState([])
  const [games, setGames] = useState([])
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortOrder, setSortOrder] = useState('default')

  const filteredGames = useMemo(() => {
    let result = games

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      result = result.filter((game) => game.name.toLowerCase().includes(query))
    }

    if (sortOrder === 'az') {
      result = [...result].sort((a, b) => a.name.localeCompare(b.name))
    } else if (sortOrder === 'za') {
      result = [...result].sort((a, b) => b.name.localeCompare(a.name))
    }

    return result
  }, [games, searchQuery, sortOrder])

  const page = preferences.page || 1
  const cartCount = cart.reduce((total, item) => total + item.quantity, 0)

  useEffect(() => {
    const onPopState = () => setRoute(window.location.pathname)
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  useEffect(() => {
    window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart))
  }, [cart])

  useEffect(() => {
    window.localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(preferences))
  }, [preferences])

  useEffect(() => {
    const controller = new AbortController()

    async function loadGameNames() {
      try {
        const response = await fetch(GAME_LIST_URL, { signal: controller.signal })
        if (!response.ok) throw new Error('No se encontro juegos.txt.')

        const names = parseGameList(await response.text())
        if (!names.length) throw new Error('juegos.txt esta vacio.')

        const pages = Math.max(1, Math.ceil(names.length / PAGE_SIZE))
        setGameNames(names)
        setTotalPages(pages)
        setPreferences((current) => ({
          ...current,
          page: Math.min(Math.max(current.page || 1, 1), pages),
        }))
      } catch (loadError) {
        if (loadError.name !== 'AbortError') {
          setError('No se pudo cargar juegos.txt, asi que se muestra un catalogo demo.')
          setGameNames(DEMO_GAMES.map((game) => game.name))
          setTotalPages(1)
        }
      }
    }

    loadGameNames()
    return () => controller.abort()
  }, [])

  useEffect(() => {
    if (!gameNames.length) return

    const controller = new AbortController()
    const apiKey = import.meta.env.VITE_RAWG_API_KEY

    async function loadGames() {
      const start = (page - 1) * PAGE_SIZE
      const pageNames = gameNames.slice(start, start + PAGE_SIZE)

      setLoading(true)
      setError('')

      try {
        if (!apiKey) {
          setError('Modo demo activo. Agrega tu API key de RAWG en VITE_RAWG_API_KEY para cargar imagenes reales.')
          setGames(
            pageNames.map((name, index) => ({
              id: `list-${page}-${index}`,
              name,
              background_image: `https://picsum.photos/seed/${encodeURIComponent(name)}/640/480`,
              notInRawg: false,
            })),
          )
          return
        }

        const results = await Promise.all(
          pageNames.map(async (name, index) => {
            const params = new URLSearchParams({
              key: apiKey,
              page_size: '1',
              search: name,
            })
            const response = await fetch(`${RAWG_API}?${params}`, {
              signal: controller.signal,
            })

            if (!response.ok) throw new Error('RAWG no pudo responder.')

            const data = await response.json()
            const match = data.results?.[0]

            return {
              id: match?.id ? `rawg-${match.id}` : `list-${page}-${index}`,
              name: match?.name || name,
              background_image: match?.background_image,
              originalName: name,
              notInRawg: !match,
            }
          }),
        )

        // Log missing games to developer console
        const missing = results.filter(g => g.notInRawg).map(g => g.originalName)
        if (missing.length > 0) {
          console.warn("⚠️ Los siguientes juegos no se encontraron en la API de RAWG (usando datos locales):", missing)
        }

        setGames(results)
      } catch (loadError) {
        if (loadError.name !== 'AbortError') {
          setError('No se pudieron cargar los juegos desde RAWG. Revisa tu API key o conexion.')
        }
      } finally {
        setLoading(false)
      }
    }

    loadGames()
    return () => controller.abort()
  }, [gameNames, page])

  const navigate = (path) => {
    window.history.pushState({}, '', path)
    setRoute(path)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const updatePage = (nextPage) => {
    setPreferences((current) => ({
      ...current,
      page: Math.min(Math.max(nextPage, 1), totalPages),
    }))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const addToCart = (game) => {
    setCart((current) => {
      const existing = current.find((item) => item.id === game.id)
      if (existing) {
        return current.map((item) =>
          item.id === game.id ? { ...item, quantity: item.quantity + 1 } : item,
        )
      }

      return [
        ...current,
        {
          id: game.id,
          name: game.name,
          image: gameImage(game),
          quantity: 1,
        },
      ]
    })
  }

  const setCartQuantity = (id, quantity) => {
    setCart((current) =>
      current
        .map((item) => (item.id === id ? { ...item, quantity } : item))
        .filter((item) => item.quantity > 0),
    )
  }

  const clearCart = () => setCart([])

  const buyMessage = useMemo(() => {
    const items = cart
      .map((item) => `- ${item.name}${item.quantity > 1 ? ` x${item.quantity}` : ''}`)
      .join('\n')
    return `Hola, quiero comprar estos juegos:\n${items}`
  }, [cart])

  const buyGames = () => {
    if (!cart.length) return
    window.open(`${WHATSAPP_URL}?text=${encodeURIComponent(buyMessage)}`, '_blank')
    clearCart()
  }

  return (
    <div className="min-h-screen bg-[#08030f] text-purple-50">
      <header className="sticky top-0 z-20 border-b border-fuchsia-300/10 bg-[#0b0414]/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="flex items-center gap-2 rounded-md px-2 py-2 text-left text-white transition hover:bg-fuchsia-300/10"
          >
            <Gamepad2 className="h-6 w-6 text-fuchsia-300" />
            <span className="text-base font-black tracking-wide sm:text-xl">Mapache Gamer</span>
          </button>

          <nav className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => navigate('/')}
              className="inline-flex h-10 items-center gap-2 rounded-md border border-fuchsia-200/15 px-3 text-sm font-semibold text-purple-100 transition hover:border-fuchsia-300/70 hover:text-white"
            >
              <Home className="h-4 w-4" />
              <span className="hidden sm:inline">Catalogo</span>
            </button>
            <button
              type="button"
              onClick={() => navigate('/carrito')}
              className="inline-flex h-10 items-center gap-2 rounded-md bg-fuchsia-400 px-3 text-sm font-black text-[#12001f] shadow-lg shadow-fuchsia-500/20 transition hover:bg-fuchsia-300"
            >
              <ShoppingCart className="h-4 w-4" />
              <span>Carrito</span>
              <span className="rounded bg-[#150024] px-1.5 py-0.5 text-xs text-fuchsia-200">
                {cartCount}
              </span>
            </button>
          </nav>
        </div>
      </header>

      {route === '/carrito' ? (
        <CartPage
          cart={cart}
          onBack={() => navigate('/')}
          onBuy={buyGames}
          onClear={clearCart}
          onQuantity={setCartQuantity}
        />
      ) : (
        <CatalogPage
          error={error}
          games={filteredGames}
          loading={loading}
          page={page}
          totalPages={totalPages}
          onAdd={addToCart}
          onNext={() => updatePage(page + 1)}
          onPrevious={() => updatePage(page - 1)}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          sortOrder={sortOrder}
          onSortChange={setSortOrder}
        />
      )}
    </div>
  )
}

function CatalogPage({
  error,
  games,
  loading,
  onAdd,
  onNext,
  onPrevious,
  page,
  totalPages,
  searchQuery,
  onSearchChange,
  sortOrder,
  onSortChange,
}) {
  return (
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:py-8">
      <section className="mb-6 sm:mb-8">
        <h1 className="text-3xl font-black tracking-normal text-white sm:text-5xl">
          Juegos disponibles
        </h1>
      </section>

      {/* Search bar + Filters in the same row */}
      <section className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        {/* Search input */}
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fuchsia-300/60" />
          <input
            id="search-games"
            type="text"
            placeholder="Buscar juegos..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="h-11 w-full rounded-md border border-fuchsia-200/15 bg-[#13071f] pl-10 pr-10 text-base sm:text-sm font-medium text-white placeholder-purple-100/40 shadow-lg shadow-black/20 outline-none transition focus:border-fuchsia-400/60 focus:ring-1 focus:ring-fuchsia-400/40"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-0.5 text-purple-100/40 transition hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Filters section (dropdown sort next to search) */}
        <div className="flex items-center gap-2">
          <label htmlFor="sort-order" className="sr-only">
            Ordenar por
          </label>
          <select
            id="sort-order"
            value={sortOrder}
            onChange={(e) => onSortChange(e.target.value)}
            className="h-11 w-full sm:w-auto rounded-md border border-fuchsia-200/15 bg-[#13071f] px-4 text-base sm:text-sm font-bold text-purple-100 outline-none transition focus:border-fuchsia-400/60 hover:border-fuchsia-300/40 focus:ring-1 focus:ring-fuchsia-400/40"
          >
            <option value="default">Por defecto</option>
            <option value="az">Ordenar: A – Z</option>
            <option value="za">Ordenar: Z – A</option>
          </select>
        </div>
      </section>

      <Pagination page={page} totalPages={totalPages} onNext={onNext} onPrevious={onPrevious} />

      {error ? (
        <div className="mt-6 rounded-md border border-fuchsia-300/30 bg-fuchsia-500/10 p-4 text-sm text-fuchsia-100">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="grid min-h-96 place-items-center">
          <Loader2 className="h-10 w-10 animate-spin text-fuchsia-300" />
        </div>
      ) : games.length === 0 && searchQuery ? (
        <div className="mt-10 flex flex-col items-center gap-3 text-center">
          <Search className="h-10 w-10 text-fuchsia-300/40" />
          <p className="text-lg font-bold text-white">Sin resultados</p>
          <p className="text-sm text-purple-100/60">
            No se encontraron juegos para "{searchQuery}"
          </p>
        </div>
      ) : (
        <section className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-5 xl:grid-cols-6">
          {games.map((game) => (
            <GameCard key={game.id} game={game} onAdd={onAdd} />
          ))}
        </section>
      )}

      {!loading && !error && games.length ? (
        <div className="mt-8">
          <Pagination page={page} totalPages={totalPages} onNext={onNext} onPrevious={onPrevious} />
        </div>
      ) : null}
    </main>
  )
}

function Pagination({ onNext, onPrevious, page, totalPages }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-fuchsia-200/10 bg-fuchsia-300/[0.06] p-2 shadow-xl shadow-black/20">
      <button
        type="button"
        onClick={onPrevious}
        disabled={page <= 1}
        className="inline-flex h-10 items-center gap-2 rounded-md px-3 text-sm font-bold text-purple-100 transition hover:bg-fuchsia-300/10 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <ChevronLeft className="h-4 w-4" />
        <span className="hidden sm:inline">Anterior</span>
      </button>
      <span className="text-sm font-bold text-purple-100/80">
        Pagina {page} de {totalPages}
      </span>
      <button
        type="button"
        onClick={onNext}
        disabled={page >= totalPages}
        className="inline-flex h-10 items-center gap-2 rounded-md px-3 text-sm font-bold text-purple-100 transition hover:bg-fuchsia-300/10 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <span className="hidden sm:inline">Siguiente</span>
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  )
}

function GameCard({ game, onAdd }) {
  return (
    <article className="relative overflow-hidden rounded-md border border-fuchsia-200/10 bg-[#13071f] shadow-2xl shadow-black/30 transition hover:-translate-y-0.5 hover:border-fuchsia-300/35 hover:shadow-fuchsia-950/40">
      {game.notInRawg && (
        <span className="absolute left-2 top-2 rounded bg-black/75 px-1.5 py-0.5 text-[10px] font-extrabold text-amber-300 border border-amber-300/30 backdrop-blur-sm z-10 select-none">
          Nombre Local
        </span>
      )}
      <img
        src={gameImage(game)}
        alt={game.name}
        loading="lazy"
        className="aspect-[4/3] w-full object-cover"
      />
      <div className="flex min-h-32 flex-col gap-3 p-3">
        <h2 className="line-clamp-2 min-h-10 text-sm font-bold leading-5 text-white">
          {game.name}
        </h2>
        <button
          type="button"
          onClick={() => onAdd(game)}
          className="mt-auto inline-flex h-10 items-center justify-center gap-2 rounded-md bg-fuchsia-400 px-3 text-sm font-black text-[#12001f] shadow-lg shadow-fuchsia-500/20 transition hover:bg-fuchsia-300"
        >
          <ShoppingCart className="h-4 w-4" />
          Agregar
        </button>
      </div>
    </article>
  )
}

function CartPage({ cart, onBack, onBuy, onClear, onQuantity }) {
  const total = cart.reduce((sum, item) => sum + item.quantity, 0)

  return (
    <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:py-8">
      <section className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-fuchsia-300">
            Tu seleccion
          </p>
          <h1 className="mt-2 text-3xl font-black text-white sm:text-5xl">Carrito</h1>
        </div>
        <p className="text-sm font-semibold text-purple-100/75">{total} juegos agregados</p>
      </section>

      {!cart.length ? (
        <div className="rounded-md border border-fuchsia-200/10 bg-[#13071f] p-8 text-center shadow-2xl shadow-black/30">
          <ShoppingCart className="mx-auto h-12 w-12 text-fuchsia-300/60" />
          <h2 className="mt-4 text-xl font-black text-white">Tu carrito esta vacio</h2>
          <button
            type="button"
            onClick={onBack}
            className="mt-5 inline-flex h-11 items-center justify-center rounded-md bg-fuchsia-400 px-5 text-sm font-black text-[#12001f] transition hover:bg-fuchsia-300"
          >
            Ver catalogo
          </button>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {cart.map((item) => (
              <article
                key={item.id}
                className="grid grid-cols-[72px_1fr] gap-3 rounded-md border border-fuchsia-200/10 bg-[#13071f] p-3 shadow-xl shadow-black/20 sm:grid-cols-[96px_1fr_auto]"
              >
                <img
                  src={item.image}
                  alt={item.name}
                  className="aspect-square w-full rounded-md object-cover"
                />
                <div className="min-w-0">
                  <h2 className="line-clamp-2 text-base font-black text-white">{item.name}</h2>
                  <p className="mt-1 text-sm text-purple-100/60">Listo para comprar por WhatsApp</p>
                </div>
                <div className="col-span-2 flex items-center justify-between gap-2 sm:col-span-1">
                  <div className="flex items-center rounded-md border border-fuchsia-200/10 bg-[#0b0414]">
                    <button
                      type="button"
                      onClick={() => onQuantity(item.id, item.quantity - 1)}
                      className="grid h-10 w-10 place-items-center text-purple-100 transition hover:bg-fuchsia-300/10"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <span className="w-10 text-center text-sm font-black text-white">
                      {item.quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => onQuantity(item.id, item.quantity + 1)}
                      className="grid h-10 w-10 place-items-center text-purple-100 transition hover:bg-fuchsia-300/10"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => onQuantity(item.id, 0)}
                    className="grid h-10 w-10 place-items-center rounded-md text-pink-200 transition hover:bg-pink-400/10"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </article>
            ))}
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClear}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-fuchsia-200/15 px-5 text-sm font-bold text-purple-100 transition hover:bg-fuchsia-300/10"
            >
              <Trash2 className="h-4 w-4" />
              Vaciar
            </button>
            <button
              type="button"
              onClick={onBuy}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-cyan-300 px-5 text-sm font-black text-[#07111f] shadow-lg shadow-cyan-500/20 transition hover:bg-cyan-200"
            >
              <WhatsAppIcon />
              Comprar
            </button>
          </div>
        </>
      )}
    </main>
  )
}

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 fill-current">
      <path d="M19.05 4.91A9.82 9.82 0 0 0 12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.9 9.9 0 0 0 4.74 1.21h.01c5.46 0 9.91-4.45 9.91-9.91a9.83 9.83 0 0 0-2.91-7.01ZM12.05 20.15h-.01a8.23 8.23 0 0 1-4.19-1.15l-.3-.18-3.11.82.83-3.03-.2-.31a8.21 8.21 0 0 1-1.26-4.38c0-4.55 3.7-8.25 8.25-8.25a8.2 8.2 0 0 1 5.83 2.42 8.2 8.2 0 0 1 2.42 5.83c-.01 4.54-3.71 8.23-8.26 8.23Zm4.52-6.16c-.25-.12-1.47-.72-1.69-.8-.23-.08-.39-.12-.56.12-.16.25-.64.8-.78.97-.14.16-.29.18-.53.06-.25-.12-1.04-.38-1.98-1.22-.73-.65-1.22-1.45-1.36-1.7-.14-.25-.02-.38.11-.5.11-.11.25-.29.37-.43.12-.14.16-.25.25-.41.08-.17.04-.31-.02-.43-.06-.12-.56-1.35-.76-1.85-.2-.48-.41-.42-.56-.43h-.48c-.16 0-.43.06-.66.31-.23.25-.87.85-.87 2.07 0 1.22.89 2.4 1.01 2.56.12.17 1.75 2.67 4.24 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.47-.07 1.47-.6 1.67-1.18.21-.58.21-1.08.14-1.18-.06-.1-.22-.16-.47-.28Z" />
    </svg>
  )
}

export default App
