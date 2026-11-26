export function Notice({ error, loading, empty }) {
  if (error) return <p className="error" role="alert">{error.message}</p>
  if (loading) return <p className="state" role="status">Carregando…</p>
  return empty ? <p className="state">{empty}</p> : null
}

export function Success({ message }) {
  return message ? <p className="success" role="status">{message}</p> : null
}

export function Pagination({ pagination, onPage, disabled }) {
  if (!pagination || pagination.totalPages <= 1) return null
  const { page, totalPages } = pagination
  return (
    <nav className="table-pages" aria-label="Paginação">
      <button className="secondary" type="button" disabled={disabled || page <= 1} onClick={() => onPage(page - 1)}>Anterior</button>
      <span>Página {page} de {totalPages}</span>
      <button className="secondary" type="button" disabled={disabled || page >= totalPages} onClick={() => onPage(page + 1)}>Próxima</button>
    </nav>
  )
}

export function SearchField({ label, value, onSearch }) {
  return (
    <form className="admin-search" role="search" onSubmit={event => {
      event.preventDefault()
      onSearch(new FormData(event.currentTarget).get('search').trim())
    }}>
      <label className="field">{label}<input type="search" name="search" maxLength={120} defaultValue={value} key={value} /></label>
      <button type="submit" className="secondary">Buscar</button>
      {value && <button type="button" className="text-button" onClick={() => onSearch('')}>Limpar busca</button>}
    </form>
  )
}
