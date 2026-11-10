import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Search, SlidersHorizontal, TimerOff } from 'lucide-react'
import { bulkUpdateItemStatus, expireItems, listItems, type AdminItemKind } from '../../services/admin'
import { useCategories, useLocations } from '../../hooks/useLookups'
import { formatDate } from '../../lib/format'
import { EmptyState, ErrorState, PageHeader, SkeletonList } from '../../components/ui'
import { StatusBadge } from '../../components/items/StatusBadge'
import { FOUND_ITEM_STATUSES, LOST_ITEM_STATUSES } from '../../types'

const PAGE_SIZE = 25

/** /admin/items — lost / found tabs, filters, bulk status changes, manual expiry. */
export function AdminItemsPage() {
  const queryClient = useQueryClient()
  const [params, setParams] = useSearchParams()
  const tab: AdminItemKind = params.get('tab') === 'found' ? 'found' : 'lost'
  const status = params.get('status') ?? ''
  const [categoryId, setCategoryId] = useState('')
  const [locationId, setLocationId] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkStatus, setBulkStatus] = useState('')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const { data: categories } = useCategories()
  const { data: locations } = useLocations()

  const filters = { status, categoryId, locationId, from, to, search, page, pageSize: PAGE_SIZE }
  const query = useQuery({
    queryKey: ['admin', 'items', tab, filters],
    queryFn: () => listItems(tab, filters),
    placeholderData: keepPreviousData,
  })

  const resetPaging = () => {
    setPage(0)
    setSelected(new Set())
  }
  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    if (key === 'tab') next.delete('status')
    setParams(next, { replace: true })
    resetPaging()
  }

  const bulk = useMutation({
    mutationFn: () => bulkUpdateItemStatus(tab, [...selected], bulkStatus),
    onSuccess: (n) => {
      toast.success(`Updated ${n} item(s).`)
      setSelected(new Set())
      setBulkStatus('')
      queryClient.invalidateQueries({ queryKey: ['admin'] })
    },
  })

  const expire = useMutation({
    mutationFn: expireItems,
    onSuccess: ({ expired }) => {
      toast.success(expired ? `${expired} overdue item(s) marked unclaimed.` : 'No items are past their retention date.')
      queryClient.invalidateQueries({ queryKey: ['admin'] })
    },
  })

  const statuses = tab === 'lost' ? LOST_ITEM_STATUSES : FOUND_ITEM_STATUSES
  const rows = query.data?.rows ?? []
  const allChecked = rows.length > 0 && rows.every((r) => selected.has(r.id))
  const total = query.data?.count ?? 0
  const lastPage = Math.max(0, Math.ceil(total / PAGE_SIZE) - 1)

  return (
    <div className="page">
      <PageHeader
        title="Item Management"
        description="Browse every report, filter, and change statuses in bulk."
        actions={
          tab === 'found' && (
            <button type="button" className="btn btn-secondary" onClick={() => expire.mutate()} disabled={expire.isPending}>
              <TimerOff size={16} /> Expire overdue items
            </button>
          )
        }
      />

      <div className="tabs" role="tablist">
        <button role="tab" className="tab" aria-selected={tab === 'lost'} onClick={() => setParam('tab', 'lost')}>
          Lost items
        </button>
        <button role="tab" className="tab" aria-selected={tab === 'found'} onClick={() => setParam('tab', 'found')}>
          Found items
        </button>
      </div>

      <button
        type="button"
        className="btn btn-secondary filter-toggle"
        aria-expanded={filtersOpen}
        onClick={() => setFiltersOpen((o) => !o)}
      >
        <SlidersHorizontal size={16} /> Filters
        {[status, categoryId, locationId, from, to, search].filter(Boolean).length > 0 &&
          ` (${[status, categoryId, locationId, from, to, search].filter(Boolean).length})`}
      </button>

      <div className={`card filter-bar ${filtersOpen ? 'open' : ''}`}>
        <div className="input-with-icon">
          <Search size={16} />
          <input
            className="input"
            placeholder="Search titles"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              resetPaging()
            }}
            aria-label="Search titles"
          />
        </div>
        <select className="select" value={status} onChange={(e) => setParam('status', e.target.value)} aria-label="Status">
          <option value="">All statuses</option>
          {statuses.map((s) => (
            <option key={s} value={s}>
              {s.replace(/_/g, ' ').toLowerCase()}
            </option>
          ))}
        </select>
        <select className="select" value={categoryId} onChange={(e) => (setCategoryId(e.target.value), resetPaging())} aria-label="Category">
          <option value="">All categories</option>
          {categories?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select className="select" value={locationId} onChange={(e) => (setLocationId(e.target.value), resetPaging())} aria-label="Location">
          <option value="">All locations</option>
          {locations?.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
        <label className="field small">
          <span className="sr-only">From date</span>
          <input type="date" className="input" value={from} onChange={(e) => (setFrom(e.target.value), resetPaging())} aria-label="From date" />
        </label>
        <label className="field small">
          <span className="sr-only">To date</span>
          <input type="date" className="input" value={to} onChange={(e) => (setTo(e.target.value), resetPaging())} aria-label="To date" />
        </label>
      </div>

      {selected.size > 0 && (
        <div className="card bulk-bar">
          <strong>{selected.size} selected</strong>
          <select className="select" value={bulkStatus} onChange={(e) => setBulkStatus(e.target.value)} aria-label="New status">
            <option value="">Change status to…</option>
            {statuses.map((s) => (
              <option key={s} value={s}>
                {s.replace(/_/g, ' ').toLowerCase()}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={!bulkStatus || bulk.isPending}
            onClick={() =>
              window.confirm(`Set ${selected.size} item(s) to ${bulkStatus}? This is recorded in the audit log.`) &&
              bulk.mutate()
            }
          >
            Apply
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSelected(new Set())}>
            Clear
          </button>
        </div>
      )}

      {query.isLoading && <SkeletonList rows={8} height={48} />}
      {query.isError && <ErrorState message="Could not load items." onRetry={() => query.refetch()} />}
      {query.data && rows.length === 0 && (
        <div className="card">
          <EmptyState title="No items match these filters" />
        </div>
      )}

      {rows.length > 0 && (
        <div className="table-wrap">
          <table className="data-table stack-mobile">
            <thead>
              <tr>
                <th>
                  <input
                    type="checkbox"
                    checked={allChecked}
                    aria-label="Select all on this page"
                    onChange={(e) => setSelected(e.target.checked ? new Set(rows.map((r) => r.id)) : new Set())}
                  />
                </th>
                <th>Item</th>
                <th>Status</th>
                <th>Category</th>
                <th>Location</th>
                <th>{tab === 'lost' ? 'Date lost' : 'Date found'}</th>
                <th>{tab === 'lost' ? 'Owner' : 'Finder'}</th>
                {tab === 'found' && <th>Retention</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="has-check">
                  <td className="cell-check">
                    <input
                      type="checkbox"
                      checked={selected.has(r.id)}
                      aria-label={`Select ${r.title}`}
                      onChange={(e) => {
                        const next = new Set(selected)
                        if (e.target.checked) next.add(r.id)
                        else next.delete(r.id)
                        setSelected(next)
                      }}
                    />
                  </td>
                  <td className="cell-title">
                    <Link to={`/${tab}/${r.id}`} className="table-link">
                      {r.title}
                    </Link>
                  </td>
                  <td data-label="Status">
                    <StatusBadge status={r.status} />
                  </td>
                  <td data-label="Category">{r.category?.name}</td>
                  <td data-label="Location">{r.location?.name}</td>
                  <td data-label={tab === 'lost' ? 'Date lost' : 'Date found'}>{formatDate(r.date)}</td>
                  <td className="small" data-label={tab === 'lost' ? 'Owner' : 'Finder'}>
                    <span className="cell-value">
                      {r.owner?.full_name}
                      <span className="muted">{r.owner?.email}</span>
                    </span>
                  </td>
                  {tab === 'found' && (
                    <td className="small" data-label="Retention">
                      {formatDate(r.retention_expires_at)}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {total > PAGE_SIZE && (
        <div className="pagination">
          <button className="btn btn-secondary btn-sm" disabled={page === 0} onClick={() => (setPage((p) => p - 1), setSelected(new Set()))}>
            Previous
          </button>
          <span className="muted small">
            Page {page + 1} of {lastPage + 1} · {total} items
          </span>
          <button
            className="btn btn-secondary btn-sm"
            disabled={page >= lastPage}
            onClick={() => (setPage((p) => p + 1), setSelected(new Set()))}
          >
            Next
          </button>
        </div>
      )}
    </div>
  )
}
