import { z } from 'zod'
import { IDENTIFIER_TYPES } from '../../types'
import { todayIso } from '../../lib/format'

const text = (max: number) => z.string().trim().max(max)

const notFuture = (v: string) => v <= todayIso()

/** Client-side mirror of the Edge Function validation (spec: Zod on every form). */
export const itemFormSchema = z
  .object({
    kind: z.enum(['lost', 'found']),
    title: z.string().trim().min(3, 'Give the item a short title').max(150),
    category_id: z.string().min(1, 'Choose a category'),
    location_id: z.string().min(1, 'Choose a location'),
    date: z
      .string()
      .min(1, 'Choose a date')
      .refine(notFuture, 'The date cannot be in the future'),
    collection_point_id: z.string(),
    brand: text(80),
    model: text(80),
    color: text(40),
    description: z.string().trim().min(10, 'Describe the item in a few words (at least 10 characters)').max(2000),
    identifier_type: z.union([z.enum(IDENTIFIER_TYPES), z.literal('')]),
    identifier_value: text(100),
    private_ownership_info: text(1000),
  })
  .refine((v) => !v.identifier_value || v.identifier_type, {
    path: ['identifier_type'],
    message: 'Choose what kind of identifier this is',
  })

export type ItemFormValues = z.infer<typeof itemFormSchema>

export const IDENTIFIER_LABELS: Record<(typeof IDENTIFIER_TYPES)[number], string> = {
  NIC: 'National ID (NIC)',
  STUDENT_ID: 'Student ID',
  PASSPORT: 'Passport number',
  SERIAL_NUMBER: 'Serial number',
  IMEI: 'IMEI (phones)',
  VEHICLE_REGISTRATION: 'Vehicle registration',
  OTHER: 'Other identifier',
}

export const COLOR_SUGGESTIONS = [
  'Black', 'White', 'Grey', 'Silver', 'Blue', 'Navy', 'Red', 'Green',
  'Yellow', 'Orange', 'Pink', 'Purple', 'Brown', 'Beige', 'Gold', 'Multicolour',
]

export const blankToNull = (v: string | undefined | null) => (v && v.trim() ? v.trim() : null)
