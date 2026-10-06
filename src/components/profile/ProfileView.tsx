import React, { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import {
  User,
  ShieldCheck,
  UserCheck,
  Phone,
  MapPin,
  Mail,
  Building2,
  Lock,
  Key,
  Smartphone,
  CheckCircle2,
  AlertCircle,
  Clock,
  Shield,
  LogOut,
  Save,
  Laptop,
  Globe,
  Bell,
  Eye,
} from 'lucide-react'

type ProfileTab = 'overview' | 'edit' | 'security' | 'sessions'

export function ProfileView() {
  const {
    user,
    updateProfile,
    changePassword,
    updateSecuritySettings,
    revokeSession,
    logout,
  } = useAuth()

  const [activeTab, setActiveTab] = useState<ProfileTab>('overview')
  const [successMsg, setSuccessMsg] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  // Edit Profile Form State
  const [fullName, setFullName] = useState(user?.fullName || '')
  const [phone, setPhone] = useState(user?.phone || '')
  const [address, setAddress] = useState(user?.address || '')
  const [bio, setBio] = useState(user?.bio || '')
  const [emergencyContact, setEmergencyContact] = useState(user?.emergencyContact || '')
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl || '')
  const [assignedBranch, setAssignedBranch] = useState(user?.assignedBranch || 'Central Station Hub')

  // Change Password Form State
  const [currentPass, setCurrentPass] = useState('')
  const [newPass, setNewPass] = useState('')
  const [confirmPass, setConfirmPass] = useState('')

  if (!user) {
    return <div className="profile-container">No user logged in.</div>
  }

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)
    setSuccessMsg('')
    setErrorMsg('')
    try {
      await updateProfile({
        fullName,
        phone,
        address,
        bio,
        emergencyContact,
        avatarUrl,
        assignedBranch: user.role === 'staff' ? assignedBranch : user.assignedBranch,
      })
      setSuccessMsg('Profile updated successfully!')
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update profile.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (newPass !== confirmPass) {
      setErrorMsg('New passwords do not match.')
      return
    }
    if (newPass.length < 6) {
      setErrorMsg('Password must be at least 6 characters long.')
      return
    }
    setIsSaving(true)
    setSuccessMsg('')
    setErrorMsg('')
    try {
      await changePassword(currentPass, newPass)
      setSuccessMsg('Password changed successfully!')
      setCurrentPass('')
      setNewPass('')
      setConfirmPass('')
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to change password.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleToggleSecurity = async (key: keyof typeof user.securitySettings) => {
    try {
      await updateSecuritySettings({
        [key]: !user.securitySettings[key],
      })
      setSuccessMsg('Security settings updated.')
    } catch (err: any) {
      setErrorMsg('Failed to update security settings.')
    }
  }

  const handleRevokeSession = async (sessionId: string) => {
    try {
      await revokeSession(sessionId)
      setSuccessMsg('Session revoked.')
    } catch {
      setErrorMsg('Failed to revoke session.')
    }
  }

  return (
    <div className="profile-container" id="profile-view-page">
      {/* ── Top Header Banner ── */}
      <div className="profile-header-card">
        <div className="profile-avatar-wrap">
          <img
            src={
              user.avatarUrl ||
              'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80'
            }
            alt={user.fullName}
            className="profile-avatar-lg"
          />
          <span className={`role-badge-floating badge-${user.role}`}>
            {user.role === 'admin' && <ShieldCheck size={14} />}
            {user.role === 'staff' && <UserCheck size={14} />}
            {user.role === 'member' && <User size={14} />}
            {user.role.toUpperCase()}
          </span>
        </div>

        <div className="profile-main-meta">
          <div className="profile-title-row">
            <h1 className="profile-name-heading">{user.fullName}</h1>
            <span className="profile-email-badge">
              <Mail size={14} /> {user.email}
            </span>
          </div>

          <p className="profile-bio-text">{user.bio || 'FoundIT Smart Locker Account Holder'}</p>

          <div className="profile-meta-chips">
            {user.phone && (
              <span className="meta-chip">
                <Phone size={13} /> {user.phone}
              </span>
            )}
            {user.address && (
              <span className="meta-chip">
                <MapPin size={13} /> {user.address}
              </span>
            )}
            {user.assignedBranch && (
              <span className="meta-chip chip-highlight">
                <Building2 size={13} /> {user.assignedBranch}
              </span>
            )}
            <span className="meta-chip">
              <Clock size={13} /> Member since {new Date(user.createdAt).toLocaleDateString()}
            </span>
          </div>
        </div>

        <div className="profile-header-actions">
          <button
            className="profile-btn-logout"
            onClick={logout}
            title="Log out of session"
          >
            <LogOut size={16} /> Log Out
          </button>
        </div>
      </div>

      {/* Alerts */}
      {successMsg && (
        <div className="profile-toast toast-success">
          <CheckCircle2 size={18} /> <span>{successMsg}</span>
        </div>
      )}
      {errorMsg && (
        <div className="profile-toast toast-error">
          <AlertCircle size={18} /> <span>{errorMsg}</span>
        </div>
      )}

      {/* ── Sub Navigation Tabs ── */}
      <nav className="profile-tabs-nav">
        <button
          className={`profile-tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          <User size={16} /> Overview & Roles
        </button>
        <button
          className={`profile-tab-btn ${activeTab === 'edit' ? 'active' : ''}`}
          onClick={() => setActiveTab('edit')}
        >
          <Save size={16} /> Edit Profile
        </button>
        <button
          className={`profile-tab-btn ${activeTab === 'security' ? 'active' : ''}`}
          onClick={() => setActiveTab('security')}
        >
          <Shield size={16} /> Security & 2FA
        </button>
        <button
          className={`profile-tab-btn ${activeTab === 'sessions' ? 'active' : ''}`}
          onClick={() => setActiveTab('sessions')}
        >
          <Laptop size={16} /> Active Sessions ({user.sessions.length})
        </button>
      </nav>

      {/* ── Tab Content Area ── */}
      <div className="profile-content-body">
        {/* Tab 1: Overview & Role Capabilities */}
        {activeTab === 'overview' && (
          <div className="tab-pane-grid">
            <div className="info-card">
              <h3 className="card-section-title">Account Summary</h3>
              <div className="details-list">
                <div className="detail-row">
                  <span className="detail-label">Full Name:</span>
                  <span className="detail-val">{user.fullName}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Email:</span>
                  <span className="detail-val">{user.email}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">User ID:</span>
                  <span className="detail-val code-font">{user.id}</span>
                </div>
                {user.employeeId && (
                  <div className="detail-row">
                    <span className="detail-label">Employee ID:</span>
                    <span className="detail-val code-font">{user.employeeId}</span>
                  </div>
                )}
                {user.department && (
                  <div className="detail-row">
                    <span className="detail-label">Department:</span>
                    <span className="detail-val">{user.department}</span>
                  </div>
                )}
                <div className="detail-row">
                  <span className="detail-label">Emergency Contact:</span>
                  <span className="detail-val">{user.emergencyContact || 'Not provided'}</span>
                </div>
              </div>
            </div>

            <div className="info-card">
              <h3 className="card-section-title">
                Role & Permissions Matrix (
                <span className="text-highlight">{user.role.toUpperCase()}</span>)
              </h3>
              <p className="section-subtitle">
                Capabilities granted to your account in FoundIT Smart Locker ecosystem:
              </p>
              <ul className="capabilities-list">
                {user.role === 'member' && (
                  <>
                    <li><CheckCircle2 size={16} color="#22c55e" /> Search & Browse Found Items Database</li>
                    <li><CheckCircle2 size={16} color="#22c55e" /> File Lost Item Reports with Photo/Location</li>
                    <li><CheckCircle2 size={16} color="#22c55e" /> Submit Digital Claims with Locker QR Verification</li>
                    <li><CheckCircle2 size={16} color="#22c55e" /> Receive Real-time Match & Pickup Notifications</li>
                  </>
                )}
                {user.role === 'staff' && (
                  <>
                    <li><CheckCircle2 size={16} color="#22c55e" /> Full Member Access + Station Management</li>
                    <li><CheckCircle2 size={16} color="#22c55e" /> Locker Drawer Control (Servo Unlock & Sensor Verification)</li>
                    <li><CheckCircle2 size={16} color="#22c55e" /> Verify RFID Badges & In-person Claim Inspections</li>
                    <li><CheckCircle2 size={16} color="#22c55e" /> Station Assigned: {user.assignedBranch || 'Central Hub'}</li>
                  </>
                )}
                {user.role === 'admin' && (
                  <>
                    <li><CheckCircle2 size={16} color="#22c55e" /> Full System & Fleet Administration</li>
                    <li><CheckCircle2 size={16} color="#22c55e" /> IoT Hardware Telemetry & Sensor Diagnostics</li>
                    <li><CheckCircle2 size={16} color="#22c55e" /> User Roles, Security Audit & Permissions Control</li>
                    <li><CheckCircle2 size={16} color="#22c55e" /> Supabase Database Synchronization & Chains of Custody</li>
                  </>
                )}
              </ul>
            </div>
          </div>
        )}

        {/* Tab 2: Edit Profile Form */}
        {activeTab === 'edit' && (
          <form className="info-card edit-profile-card" onSubmit={handleSaveProfile}>
            <h3 className="card-section-title">Edit Profile Information</h3>
            <div className="form-grid-2col">
              <div className="form-field">
                <label>Full Name *</label>
                <input
                  type="text"
                  className="profile-input"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
              </div>

              <div className="form-field">
                <label>Phone Number</label>
                <input
                  type="tel"
                  className="profile-input"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+1 (555) 000-0000"
                />
              </div>

              <div className="form-field">
                <label>Address / City</label>
                <input
                  type="text"
                  className="profile-input"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Street, City, State"
                />
              </div>

              <div className="form-field">
                <label>Avatar URL</label>
                <input
                  type="url"
                  className="profile-input"
                  value={avatarUrl}
                  onChange={(e) => setAvatarUrl(e.target.value)}
                  placeholder="https://image-link.com/avatar.jpg"
                />
              </div>

              <div className="form-field full-width">
                <label>Emergency Contact Info</label>
                <input
                  type="text"
                  className="profile-input"
                  value={emergencyContact}
                  onChange={(e) => setEmergencyContact(e.target.value)}
                  placeholder="Name & Contact number"
                />
              </div>

              {user.role === 'staff' && (
                <div className="form-field full-width">
                  <label>Assigned Station Branch</label>
                  <select
                    className="profile-input"
                    value={assignedBranch}
                    onChange={(e) => setAssignedBranch(e.target.value)}
                  >
                    <option value="Central Station Hub">Central Station Hub</option>
                    <option value="Downtown Office Locker">Downtown Office Locker</option>
                    <option value="Airport Terminal 2 Depot">Airport Terminal 2 Depot</option>
                    <option value="University Campus Center">University Campus Center</option>
                  </select>
                </div>
              )}

              <div className="form-field full-width">
                <label>Bio / Description</label>
                <textarea
                  className="profile-textarea"
                  rows={3}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Brief summary about yourself..."
                />
              </div>
            </div>

            <button type="submit" className="save-btn" disabled={isSaving}>
              <Save size={16} /> {isSaving ? 'Saving Updates...' : 'Save Profile Changes'}
            </button>
          </form>
        )}

        {/* Tab 3: Security & 2FA */}
        {activeTab === 'security' && (
          <div className="tab-pane-grid">
            {/* Change Password Card */}
            <form className="info-card" onSubmit={handleChangePassword}>
              <h3 className="card-section-title">
                <Key size={18} /> Change Account Password
              </h3>
              <div className="form-grid-1col">
                <div className="form-field">
                  <label>Current Password *</label>
                  <input
                    type="password"
                    className="profile-input"
                    value={currentPass}
                    onChange={(e) => setCurrentPass(e.target.value)}
                    required
                  />
                </div>
                <div className="form-field">
                  <label>New Password *</label>
                  <input
                    type="password"
                    className="profile-input"
                    value={newPass}
                    onChange={(e) => setNewPass(e.target.value)}
                    required
                  />
                </div>
                <div className="form-field">
                  <label>Confirm New Password *</label>
                  <input
                    type="password"
                    className="profile-input"
                    value={confirmPass}
                    onChange={(e) => setConfirmPass(e.target.value)}
                    required
                  />
                </div>
              </div>
              <button type="submit" className="save-btn" disabled={isSaving}>
                <Lock size={16} /> Update Password
              </button>
            </form>

            {/* Security Toggles Card */}
            <div className="info-card">
              <h3 className="card-section-title">
                <ShieldCheck size={18} /> Account Security & Preferences
              </h3>
              <div className="toggles-list">
                <div className="toggle-row">
                  <div className="toggle-info">
                    <span className="toggle-title"><Smartphone size={16} /> Two-Factor Authentication (2FA)</span>
                    <span className="toggle-desc">Require SMS / Authenticator app verification on login</span>
                  </div>
                  <button
                    className={`toggle-switch ${user.securitySettings.twoFactorEnabled ? 'on' : 'off'}`}
                    onClick={() => handleToggleSecurity('twoFactorEnabled')}
                  >
                    <span className="switch-knob" />
                  </button>
                </div>

                <div className="toggle-row">
                  <div className="toggle-info">
                    <span className="toggle-title"><Bell size={16} /> Login Alerts</span>
                    <span className="toggle-desc">Send notification on new unrecognized device login</span>
                  </div>
                  <button
                    className={`toggle-switch ${user.securitySettings.loginAlerts ? 'on' : 'off'}`}
                    onClick={() => handleToggleSecurity('loginAlerts')}
                  >
                    <span className="switch-knob" />
                  </button>
                </div>

                <div className="toggle-row">
                  <div className="toggle-info">
                    <span className="toggle-title"><Mail size={16} /> Email Notifications</span>
                    <span className="toggle-desc">Receive locker match updates via registered email</span>
                  </div>
                  <button
                    className={`toggle-switch ${user.securitySettings.emailNotifications ? 'on' : 'off'}`}
                    onClick={() => handleToggleSecurity('emailNotifications')}
                  >
                    <span className="switch-knob" />
                  </button>
                </div>

                <div className="toggle-row">
                  <div className="toggle-info">
                    <span className="toggle-title"><Eye size={16} /> Public Profile</span>
                    <span className="toggle-desc">Allow verified members to view contact info for claims</span>
                  </div>
                  <button
                    className={`toggle-switch ${user.securitySettings.publicProfile ? 'on' : 'off'}`}
                    onClick={() => handleToggleSecurity('publicProfile')}
                  >
                    <span className="switch-knob" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 4: Active Sessions */}
        {activeTab === 'sessions' && (
          <div className="info-card">
            <h3 className="card-section-title">
              <Laptop size={18} /> Active Login Sessions
            </h3>
            <p className="section-subtitle">
              Devices currently authorized for your FoundIT account:
            </p>
            <div className="sessions-list">
              {user.sessions.map((sess) => (
                <div key={sess.id} className={`session-card ${sess.isCurrent ? 'current' : ''}`}>
                  <div className="session-icon">
                    <Laptop size={24} />
                  </div>
                  <div className="session-info">
                    <div className="session-header">
                      <span className="session-device">{sess.device}</span>
                      {sess.isCurrent && <span className="current-badge">Current Device</span>}
                    </div>
                    <div className="session-meta">
                      <span><Globe size={13} /> {sess.ip} ({sess.location})</span>
                      <span><Clock size={13} /> Last active: {sess.lastActive}</span>
                    </div>
                  </div>
                  {!sess.isCurrent && (
                    <button
                      className="revoke-btn"
                      onClick={() => handleRevokeSession(sess.id)}
                    >
                      Revoke Access
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
