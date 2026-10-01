import React, { useState, useEffect } from 'react'
import { LocalDbService } from '../../services/localDb'
import type { UserProfile, UserRole } from '../../types/auth'
import { Trash2, Edit2, ShieldCheck, User as UserIcon, UserCheck } from 'lucide-react'

export function AdminUsersView() {
  const [users, setUsers] = useState<UserProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchUsers()
  }, [])

  const fetchUsers = async () => {
    setLoading(true)
    try {
      const allUsers = await LocalDbService.getAllUsers()
      setUsers(allUsers)
    } catch (err: any) {
      setError(err.message || 'Failed to load users')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (userId: string, email: string) => {
    if (!window.confirm(`Are you sure you want to completely remove user ${email}?`)) return
    try {
      await LocalDbService.deleteUser(userId)
      setUsers(users.filter((u) => u.id !== userId))
    } catch (err: any) {
      alert(err.message || 'Failed to delete user')
    }
  }

  const handleRoleChange = async (userId: string, newRole: UserRole) => {
    try {
      const updatedUser = await LocalDbService.updateUser(userId, { role: newRole })
      setUsers(users.map((u) => (u.id === userId ? updatedUser : u)))
    } catch (err: any) {
      alert(err.message || 'Failed to update user role')
    }
  }

  if (loading) return <div style={{ padding: '2rem' }}>Loading system users...</div>
  if (error) return <div style={{ padding: '2rem', color: 'red' }}>Error: {error}</div>

  return (
    <div style={{ padding: '2rem', width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2rem' }}>
        <h2>System Users Administration</h2>
        <span style={{ padding: '0.5rem 1rem', background: '#f1f5f9', borderRadius: '8px', fontWeight: 600 }}>
          Total Users: {users.length}
        </span>
      </div>

      <div style={{ overflowX: 'auto', background: 'white', borderRadius: '16px', boxShadow: '0 4px 24px rgba(0,0,0,0.04)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #f1f5f9' }}>
              <th style={{ padding: '1rem', color: '#64748b' }}>User</th>
              <th style={{ padding: '1rem', color: '#64748b' }}>Role</th>
              <th style={{ padding: '1rem', color: '#64748b' }}>Joined</th>
              <th style={{ padding: '1rem', color: '#64748b', textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} style={{ borderBottom: '1px solid #f1f5f9', transition: 'background 0.2s' }}>
                <td style={{ padding: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#ffedd5', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ea580c', fontWeight: 'bold' }}>
                      {u.fullName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, color: '#1e293b' }}>{u.fullName}</div>
                      <div style={{ fontSize: '0.85rem', color: '#64748b' }}>{u.email}</div>
                    </div>
                  </div>
                </td>
                <td style={{ padding: '1rem' }}>
                  <select
                    value={u.role}
                    onChange={(e) => handleRoleChange(u.id, e.target.value as UserRole)}
                    style={{
                      padding: '0.4rem 0.8rem',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      background: u.role === 'admin' ? '#fee2e2' : u.role === 'staff' ? '#fef9c3' : '#f1f5f9',
                      color: u.role === 'admin' ? '#991b1b' : u.role === 'staff' ? '#854d0e' : '#334155',
                      fontWeight: 600,
                      outline: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    <option value="member">Member</option>
                    <option value="staff">Staff</option>
                    <option value="admin">Admin</option>
                  </select>
                </td>
                <td style={{ padding: '1rem', color: '#64748b', fontSize: '0.9rem' }}>
                  {new Date(u.createdAt).toLocaleDateString()}
                </td>
                <td style={{ padding: '1rem', textAlign: 'right' }}>
                  <button
                    onClick={() => handleDelete(u.id, u.email)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#ef4444',
                      cursor: 'pointer',
                      padding: '8px',
                      borderRadius: '8px',
                      transition: 'background 0.2s'
                    }}
                    title="Delete User"
                    onMouseOver={(e) => e.currentTarget.style.background = '#fee2e2'}
                    onMouseOut={(e) => e.currentTarget.style.background = 'none'}
                  >
                    <Trash2 size={18} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
