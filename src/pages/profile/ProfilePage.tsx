import { useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import {
  Camera,
  Clock,
  KeyRound,
  LogOut,
  Mail,
  MapPin,
  Phone,
  Save,
  Shield,
  ShieldCheck,
  User,
  UserCheck,
} from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { resetPassword, signOut, updatePassword } from '../../services/auth'
import { uploadProfileImage } from '../../services/profile'
import { friendlyError, toastError } from '../../lib/errors'
import { formatDate } from '../../lib/format'
import { Avatar, FieldError } from '../../components/ui'
import { newPasswordSchema } from '../auth/schemas'

type ProfileTab = 'overview' | 'edit' | 'security'

const profileSchema = z.object({
  full_name: z.string().trim().min(2, 'Enter your full name').max(100),
  phone: z
    .string()
    .trim()
    .max(20)
    .regex(/^[+\d\s()-]*$/, 'Use digits, spaces, +, - or ()'),
  address: z.string().trim().max(200),
  bio: z.string().trim().max(500),
})

type ProfileValues = z.infer<typeof profileSchema>

export function ProfilePage() {
  const { profile, user, isAdmin, isCollectionOfficer, updateProfile, logout } = useAuth()
  const [activeTab, setActiveTab] = useState<ProfileTab>('overview')
  const [uploading, setUploading] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)

  if (!profile || !user) return null

  const onAvatarChange = async (file: File | undefined) => {
    if (!file) return
    setUploading(true)
    try {
      const url = await uploadProfileImage(user.id, file)
      await updateProfile({ profile_image: url })
      toast.success('Profile photo updated.')
    } catch (err) {
      toastError(err)
    } finally {
      setUploading(false)
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  return (
    <div className="profile-container" id="profile-view-page">
      <div className="profile-header-card">
        <div className="profile-avatar-wrap">
          <button
            type="button"
            className="profile-avatar-button"
            onClick={() => fileInput.current?.click()}
            disabled={uploading}
            aria-label="Change profile photo"
            title="Change profile photo"
          >
            <Avatar src={profile.profile_image} name={profile.full_name} size={96} />
            <span className="profile-avatar-overlay">
              <Camera size={18} />
            </span>
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            hidden
            onChange={(e) => onAvatarChange(e.target.files?.[0])}
          />
          <span className={`role-badge-floating badge-${isAdmin ? 'admin' : 'member'}`}>
            {isAdmin ? <ShieldCheck size={14} /> : <User size={14} />}
            {isAdmin ? 'ADMIN' : 'USER'}
          </span>
        </div>

        <div className="profile-main-meta">
          <div className="profile-title-row">
            <h1 className="profile-name-heading">{profile.full_name}</h1>
            <span className="profile-email-badge">
              <Mail size={14} /> {profile.email}
            </span>
          </div>
          <p className="profile-bio-text">{profile.bio || 'FoundIT community member'}</p>
          <div className="profile-meta-chips">
            {profile.phone && (
              <span className="meta-chip">
                <Phone size={13} /> {profile.phone}
              </span>
            )}
            {profile.address && (
              <span className="meta-chip">
                <MapPin size={13} /> {profile.address}
              </span>
            )}
            {isCollectionOfficer && (
              <span className="meta-chip chip-highlight">
                <UserCheck size={13} /> Collection officer
              </span>
            )}
            <span className="meta-chip">
              <Clock size={13} /> Member since {formatDate(profile.created_at)}
            </span>
          </div>
        </div>

        <div className="profile-header-actions">
          <button className="profile-btn-logout" onClick={logout}>
            <LogOut size={16} /> Log Out
          </button>
        </div>
      </div>

      <nav className="profile-tabs-nav" role="tablist">
        {(
          [
            ['overview', 'Overview', User],
            ['edit', 'Edit Profile', Save],
            ['security', 'Security', Shield],
          ] as const
        ).map(([id, label, Icon]) => (
          <button
            key={id}
            role="tab"
            aria-selected={activeTab === id}
            className={`profile-tab-btn ${activeTab === id ? 'active' : ''}`}
            onClick={() => setActiveTab(id)}
          >
            <Icon size={16} /> {label}
          </button>
        ))}
      </nav>

      <div className="profile-content-body">
        {activeTab === 'overview' && <OverviewTab />}
        {activeTab === 'edit' && <EditProfileTab onSaved={() => setActiveTab('overview')} />}
        {activeTab === 'security' && <SecurityTab />}
      </div>
    </div>
  )
}

function OverviewTab() {
  const { profile, isAdmin, isCollectionOfficer, user } = useAuth()
  if (!profile) return null

  return (
    <div className="tab-pane-grid">
      <div className="info-card">
        <h3 className="card-section-title">Account Summary</h3>
        <dl className="detail-grid">
          <div>
            <dt>Full name</dt>
            <dd>{profile.full_name}</dd>
          </div>
          <div>
            <dt>Email</dt>
            <dd>{profile.email}</dd>
          </div>
          <div>
            <dt>Email verified</dt>
            <dd>{user?.email_confirmed_at ? 'Yes' : 'Pending'}</dd>
          </div>
          <div>
            <dt>Phone</dt>
            <dd>{profile.phone || '—'}</dd>
          </div>
          <div>
            <dt>Role</dt>
            <dd>{isAdmin ? 'Administrator' : 'User'}</dd>
          </div>
          <div>
            <dt>Last updated</dt>
            <dd>{formatDate(profile.updated_at)}</dd>
          </div>
        </dl>
      </div>

      <div className="info-card">
        <h3 className="card-section-title">What you can do</h3>
        <ul className="capabilities-list">
          <li>Report lost items and receive a private claim credential</li>
          <li>Report items you found and hand them in at a FoundIT Box</li>
          <li>Review possible matches and submit ownership claims</li>
          {isAdmin && <li>Manage users, items, matches, claims and collection points</li>}
          {isCollectionOfficer && <li>Verify claim credentials and release items at collection points</li>}
        </ul>
      </div>
    </div>
  )
}

function EditProfileTab({ onSaved }: { onSaved: () => void }) {
  const { profile, updateProfile } = useAuth()
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      full_name: profile?.full_name ?? '',
      phone: profile?.phone ?? '',
      address: profile?.address ?? '',
      bio: profile?.bio ?? '',
    },
  })

  const onSubmit = handleSubmit(async (values) => {
    try {
      await updateProfile({
        full_name: values.full_name,
        phone: values.phone || null,
        address: values.address || null,
        bio: values.bio || null,
      })
      toast.success('Profile saved.')
      onSaved()
    } catch (err) {
      toastError(err)
    }
  })

  return (
    <form className="info-card edit-profile-card form" onSubmit={onSubmit} noValidate>
      <h3 className="card-section-title">Edit Profile</h3>
      <div className="form-row">
        <div className="field">
          <label htmlFor="full_name">Full name</label>
          <input id="full_name" className="input" aria-invalid={Boolean(errors.full_name)} {...register('full_name')} />
          <FieldError message={errors.full_name?.message} />
        </div>
        <div className="field">
          <label htmlFor="phone">Phone</label>
          <input id="phone" type="tel" className="input" aria-invalid={Boolean(errors.phone)} {...register('phone')} />
          <FieldError message={errors.phone?.message} />
        </div>
      </div>
      <div className="field">
        <label htmlFor="address">Address / city</label>
        <input id="address" className="input" {...register('address')} />
        <span className="field-hint">Only visible to you and administrators.</span>
      </div>
      <div className="field">
        <label htmlFor="bio">About you</label>
        <textarea id="bio" className="textarea" rows={3} {...register('bio')} />
        <FieldError message={errors.bio?.message} />
      </div>
      <div className="row">
        <button type="submit" className="btn btn-primary" disabled={isSubmitting || !isDirty}>
          <Save size={16} /> {isSubmitting ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </form>
  )
}

function SecurityTab() {
  const { profile } = useAuth()
  const [sendingReset, setSendingReset] = useState(false)
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof newPasswordSchema>>({ resolver: zodResolver(newPasswordSchema) })

  const onSubmit = handleSubmit(async ({ password }) => {
    try {
      await updatePassword(password)
      toast.success('Password changed.')
      reset()
    } catch (err) {
      toastError(err)
    }
  })

  const sendResetEmail = async () => {
    if (!profile) return
    setSendingReset(true)
    try {
      await resetPassword(profile.email)
      toast.success('Password reset email sent.')
    } catch (err) {
      toast.error(friendlyError(err))
    } finally {
      setSendingReset(false)
    }
  }

  const signOutEverywhere = async () => {
    if (!window.confirm('Sign out of FoundIT on all of your devices?')) return
    try {
      await signOut('global')
    } catch (err) {
      toastError(err)
    }
  }

  return (
    <div className="tab-pane-grid">
      <form className="info-card form" onSubmit={onSubmit} noValidate>
        <h3 className="card-section-title">Change password</h3>
        <div className="field">
          <label htmlFor="new-password">New password</label>
          <input id="new-password" type="password" autoComplete="new-password" className="input" {...register('password')} />
          <FieldError message={errors.password?.message} />
        </div>
        <div className="field">
          <label htmlFor="confirm-password">Confirm new password</label>
          <input
            id="confirm-password"
            type="password"
            autoComplete="new-password"
            className="input"
            {...register('confirmPassword')}
          />
          <FieldError message={errors.confirmPassword?.message} />
        </div>
        <div className="row">
          <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
            <KeyRound size={16} /> {isSubmitting ? 'Updating…' : 'Update password'}
          </button>
        </div>
      </form>

      <div className="info-card stack">
        <h3 className="card-section-title">Account security</h3>
        <p className="muted small">Forgot your current password? We can email you a secure reset link instead.</p>
        <button type="button" className="btn btn-secondary" onClick={sendResetEmail} disabled={sendingReset}>
          <Mail size={16} /> {sendingReset ? 'Sending…' : 'Email me a reset link'}
        </button>
        <div className="divider" />
        <p className="muted small">Lost a device? Signing out everywhere ends every active session, including this one.</p>
        <button type="button" className="btn btn-danger" onClick={signOutEverywhere}>
          <LogOut size={16} /> Sign out of all devices
        </button>
      </div>
    </div>
  )
}
