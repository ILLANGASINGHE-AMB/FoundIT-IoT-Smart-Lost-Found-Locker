// Row types for every table in the FoundIT schema (spec §7).
// Secret tables (lost_item_secrets, found_item_secrets) are deliberately
// absent: the client can never read them.

import type {
  AttemptType,
  ClaimStatus,
  CollectionPointStatus,
  FoundItemStatus,
  LostItemStatus,
  MatchStatus,
  NotificationChannel,
  NotificationType,
  UserRole,
  VerificationResult,
  VerificationType,
} from './enums'

export * from './enums'

export interface Profile {
  id: string
  full_name: string
  email: string
  phone: string | null
  address: string | null
  bio: string | null
  role: UserRole
  is_collection_officer: boolean
  profile_image: string | null
  created_at: string
  updated_at: string
}

export interface Category {
  id: string
  name: string
  description: string | null
  created_at: string
}

export interface Location {
  id: string
  name: string
  building: string | null
  campus_zone: string | null
  created_at: string
}

export interface CollectionPoint {
  id: string
  name: string
  location_id: string | null
  address: string | null
  description: string | null
  contact: string | null
  status: CollectionPointStatus
  qr_slug: string
  qr_active: boolean
  created_at: string
  updated_at: string
}

interface ItemBase {
  id: string
  category_id: string
  location_id: string
  title: string
  description: string
  brand: string | null
  model: string | null
  color: string | null
  identifier_type: string | null
  retention_expires_at: string | null
  created_at: string
  updated_at: string
}

export interface LostItem extends ItemBase {
  user_id: string
  date_lost: string
  status: LostItemStatus
}

export interface LostItemPrivate {
  lost_item_id: string
  private_ownership_info: string | null
  updated_at: string
}

export interface FoundItem extends ItemBase {
  finder_id: string
  date_found: string
  status: FoundItemStatus
  collection_point_id: string | null
}

export interface ItemImage {
  id: string
  lost_item_id: string | null
  found_item_id: string | null
  uploaded_by: string
  storage_path: string
  created_at: string
}

export interface ScoreBreakdownEntry {
  score: number
  weight: number
  contribution: number
  method: 'exact' | 'trigram' | 'semantic' | 'decay' | 'blend'
}

export interface ScoreBreakdown {
  category?: ScoreBreakdownEntry
  brand?: ScoreBreakdownEntry
  model?: ScoreBreakdownEntry
  color?: ScoreBreakdownEntry
  location?: ScoreBreakdownEntry
  date?: ScoreBreakdownEntry & { days_apart?: number }
  description?: ScoreBreakdownEntry & {
    trigram_similarity: number
    semantic_similarity: number | null
  }
  semantic_similarity?: number | null
  identifier_exact?: boolean
}

export interface MatchCandidate {
  id: string
  lost_item_id: string
  found_item_id: string
  score: number
  score_breakdown: ScoreBreakdown
  status: MatchStatus
  created_at: string
  updated_at: string
}

export interface Claim {
  id: string
  match_candidate_id: string | null
  lost_item_id: string
  found_item_id: string
  claimant_id: string
  status: ClaimStatus
  is_locked: boolean
  private_attribute_answer: string | null
  collection_point_id: string | null
  rejection_reason: string | null
  submitted_at: string
  reviewed_at: string | null
  approved_at: string | null
  rejected_at: string | null
  completed_at: string | null
  reviewed_by: string | null
  updated_at: string
}

export interface ClaimVerification {
  id: string
  claim_id: string
  verification_type: VerificationType
  result: VerificationResult
  verified_by: string | null
  notes: string | null
  created_at: string
}

export interface ClaimAttempt {
  id: string
  claim_id: string
  attempted_by: string
  attempt_type: AttemptType
  result: VerificationResult
  created_at: string
}

export interface Collection {
  id: string
  claim_id: string
  collected_by: string
  collected_at: string
  notes: string | null
}

export interface AppNotification {
  id: string
  user_id: string
  title: string
  message: string
  type: NotificationType
  channel: NotificationChannel
  link: string | null
  is_read: boolean
  created_at: string
}

export interface AuditLog {
  id: string
  user_id: string | null
  action: string
  entity_type: string | null
  entity_id: string | null
  metadata: Record<string, unknown>
  created_at: string
}

/** Standard `{ data, error }` envelope returned by every Edge Function. */
export interface EdgeResponse<T> {
  data: T | null
  error: { message: string; code?: string } | null
}
