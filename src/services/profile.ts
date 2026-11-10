import { supabase } from '../lib/supabase'
import type { Profile, UserRole } from '../types'

export type ProfileUpdate = Partial<Pick<Profile, 'full_name' | 'phone' | 'address' | 'bio' | 'profile_image'>>

export async function getProfile(userId: string): Promise<Profile> {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single()
  if (error) throw new Error('Could not load your profile.')
  return data as Profile
}

export async function updateProfile(userId: string, updates: ProfileUpdate): Promise<Profile> {
  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId)
    .select('*')
    .single()
  if (error) throw new Error('Could not save your profile.')
  return data as Profile
}

const AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const AVATAR_MAX_BYTES = 2 * 1024 * 1024

export async function uploadProfileImage(userId: string, file: File): Promise<string> {
  if (!AVATAR_TYPES.includes(file.type)) throw new Error('Please choose a JPEG, PNG or WebP image.')
  if (file.size > AVATAR_MAX_BYTES) throw new Error('Profile images must be 2 MB or smaller.')

  const ext = file.type.split('/')[1]
  const path = `${userId}/${crypto.randomUUID()}.${ext}`
  const { error } = await supabase.storage.from('avatars').upload(path, file, {
    cacheControl: '3600',
    contentType: file.type,
  })
  if (error) throw new Error('Could not upload the image.')

  const { data } = supabase.storage.from('avatars').getPublicUrl(path)
  return data.publicUrl
}

// ─── Admin ─────────────────────────────────────────────────────────────

export interface ProfileListParams {
  search?: string
  role?: UserRole | 'all'
  page?: number
  pageSize?: number
}

export async function listProfiles({
  search = '',
  role = 'all',
  page = 0,
  pageSize = 20,
}: ProfileListParams = {}): Promise<{ rows: Profile[]; count: number }> {
  let query = supabase
    .from('profiles')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(page * pageSize, page * pageSize + pageSize - 1)

  const term = search.trim().replace(/[%,()]/g, '')
  if (term) query = query.or(`full_name.ilike.%${term}%,email.ilike.%${term}%`)
  if (role !== 'all') query = query.eq('role', role)

  const { data, error, count } = await query
  if (error) throw new Error('Could not load users.')
  return { rows: (data ?? []) as Profile[], count: count ?? 0 }
}

export async function adminUpdateUser(
  userId: string,
  changes: { role?: UserRole; isCollectionOfficer?: boolean },
): Promise<Profile> {
  const { data, error } = await supabase.rpc('admin_update_user', {
    target_user_id: userId,
    new_role: changes.role ?? null,
    new_is_collection_officer: changes.isCollectionOfficer ?? null,
  })
  if (error) throw new Error(error.message || 'Could not update the user.')
  return data as Profile
}
