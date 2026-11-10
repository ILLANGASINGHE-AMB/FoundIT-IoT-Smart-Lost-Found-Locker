import { useState } from 'react'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Search, ShieldCheck, User as UserIcon, Users } from 'lucide-react'
import { adminUpdateUser, listProfiles } from '../../services/profile'
import { useAuth } from '../../hooks/useAuth'
import { toastError } from '../../lib/errors'
import { formatDate } from '../../lib/format'
import { Avatar, EmptyState, ErrorState, PageHeader, SkeletonList } from '../../components/ui'
import type { Profile, UserRole } from '../../types'

const PAGE_SIZE = 20

/** /admin/users — paginated user list with search, role and officer controls. */
export function AdminUsersPage() {
  const { user: me } = useAuth()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [role, setRole] = useState<UserRole | 'all'>('all')
  const [page, setPage] = useState(0)

  const query = useQuery({
    queryKey: ['admin', 'users', { search, role, page }],
    queryFn: () => listProfiles({ search, role, page, pageSize: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  })

  const mutation = useMutation({
    mutationFn: (vars: { id: string; role?: UserRole; isCollectionOfficer?: boolean }) =>
      adminUpdateUser(vars.id, vars),
    onSuccess: (updated: Profile) => {
      toast.success(`Updated ${updated.full_name}.`)
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] })
    },
    onError: (err) => toastError(err),
  })

  const total = query.data?.count ?? 0
  const lastPage = Math.max(0, Math.ceil(total / PAGE_SIZE) - 1)

  return (
    <div className="page">
      <PageHeader
        title="User Management"
        description="Search accounts, promote administrators and assign collection-officer duties."
        actions={
          <span className="pill pill-gray">
            <Users size={14} /> {total} users
          </span>
        }
      />

      <div className="row">
        <div className="field" style={{ flex: '1 1 260px' }}>
          <label htmlFor="user-search" className="sr-only">
            Search users
          </label>
          <div className="input-with-icon">
            <Search size={16} />
            <input
              id="user-search"
              className="input"
              placeholder="Search by name or email"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(0)
              }}
            />
          </div>
        </div>
        <div className="tabs" role="tablist">
          {(['all', 'user', 'admin'] as const).map((r) => (
            <button
              key={r}
              role="tab"
              className="tab"
              aria-selected={role === r}
              onClick={() => {
                setRole(r)
                setPage(0)
              }}
            >
              {r === 'all' ? 'All' : r === 'admin' ? 'Admins' : 'Users'}
            </button>
          ))}
        </div>
      </div>

      {query.isLoading && <SkeletonList rows={6} height={56} />}
      {query.isError && <ErrorState message="Could not load users." onRetry={() => query.refetch()} />}
      {query.data && query.data.rows.length === 0 && (
        <EmptyState title="No users found" description="Try a different search or filter." />
      )}

      {query.data && query.data.rows.length > 0 && (
        <div className="table-wrap">
          <table className="data-table stack-mobile">
            <thead>
              <tr>
                <th>User</th>
                <th>Joined</th>
                <th>Role</th>
                <th>Collection officer</th>
              </tr>
            </thead>
            <tbody>
              {query.data.rows.map((u) => {
                const isMe = u.id === me?.id
                const busy = mutation.isPending && mutation.variables?.id === u.id
                return (
                  <tr key={u.id}>
                    <td className="cell-title">
                      <div className="row" style={{ flexWrap: 'nowrap' }}>
                        <Avatar src={u.profile_image} name={u.full_name} size={34} />
                        <div>
                          <div style={{ fontWeight: 600 }}>
                            {u.full_name} {isMe && <span className="pill pill-gray">You</span>}
                          </div>
                          <div className="muted small">{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="muted" data-label="Joined">{formatDate(u.created_at)}</td>
                    <td data-label="Role">
                      <select
                        className="select"
                        style={{ minWidth: 130 }}
                        value={u.role}
                        disabled={busy || isMe}
                        aria-label={`Role for ${u.full_name}`}
                        onChange={(e) => mutation.mutate({ id: u.id, role: e.target.value as UserRole })}
                      >
                        <option value="user">User</option>
                        <option value="admin">Admin</option>
                      </select>
                    </td>
                    <td data-label="Officer">
                      <label className="checkbox-row">
                        <input
                          type="checkbox"
                          checked={u.is_collection_officer}
                          disabled={busy || u.role !== 'admin'}
                          onChange={(e) =>
                            mutation.mutate({ id: u.id, isCollectionOfficer: e.target.checked })
                          }
                        />
                        <span className="small muted">
                          {u.role === 'admin' ? (
                            <>
                              <ShieldCheck size={13} /> Officer duties
                            </>
                          ) : (
                            <>
                              <UserIcon size={13} /> Admins only
                            </>
                          )}
                        </span>
                      </label>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {total > PAGE_SIZE && (
        <div className="pagination">
          <button className="btn btn-secondary btn-sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
            Previous
          </button>
          <span className="muted small">
            Page {page + 1} of {lastPage + 1}
          </span>
          <button
            className="btn btn-secondary btn-sm"
            disabled={page >= lastPage}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </button>
        </div>
      )}
    </div>
  )
}
