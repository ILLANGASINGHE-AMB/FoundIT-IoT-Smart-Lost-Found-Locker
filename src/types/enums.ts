// Status enums shared by every module (mirrors the CHECK constraints in
// supabase/migrations/20261101000000_foundation.sql).

export const USER_ROLES = ['user', 'admin'] as const
export type UserRole = (typeof USER_ROLES)[number]

export const LOST_ITEM_STATUSES = [
  'LOST',
  'MATCHED',
  'FOUND',
  'CLAIM_PENDING',
  'CLAIMED',
  'RESOLVED',
  'CANCELLED',
] as const
export type LostItemStatus = (typeof LOST_ITEM_STATUSES)[number]

export const FOUND_ITEM_STATUSES = [
  'FOUND',
  'MATCHED',
  'IN_STORAGE',
  'CLAIM_PENDING',
  'CLAIMED',
  'RETURNED',
  'UNCLAIMED_EXPIRED',
  'CLOSED',
] as const
export type FoundItemStatus = (typeof FOUND_ITEM_STATUSES)[number]

export type ItemStatus = LostItemStatus | FoundItemStatus

export const MATCH_STATUSES = ['OPEN', 'DISMISSED', 'CONVERTED_TO_CLAIM'] as const
export type MatchStatus = (typeof MATCH_STATUSES)[number]

export const CLAIM_STATUSES = [
  'PENDING',
  'UNDER_REVIEW',
  'APPROVED',
  'REJECTED',
  'CANCELLED',
  'COMPLETED',
] as const
export type ClaimStatus = (typeof CLAIM_STATUSES)[number]

export type VerificationType = 'PRIVATE_ATTRIBUTE' | 'CLAIM_CODE' | 'IDENTIFIER' | 'ADMIN_REVIEW'
export type VerificationResult = 'PASSED' | 'FAILED'
export type AttemptType = 'PRIVATE_ATTRIBUTE' | 'CLAIM_CODE'

export const NOTIFICATION_TYPES = ['MATCH', 'CLAIM', 'COLLECTION', 'SYSTEM'] as const
export type NotificationType = (typeof NOTIFICATION_TYPES)[number]
export type NotificationChannel = 'IN_APP' | 'EMAIL'

export type CollectionPointStatus = 'ACTIVE' | 'INACTIVE'

export const IDENTIFIER_TYPES = [
  'NIC',
  'STUDENT_ID',
  'PASSPORT',
  'SERIAL_NUMBER',
  'IMEI',
  'VEHICLE_REGISTRATION',
  'OTHER',
] as const
export type IdentifierType = (typeof IDENTIFIER_TYPES)[number]
