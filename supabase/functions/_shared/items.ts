import { z } from 'npm:zod@4'
import { HttpError } from './http.ts'
import { env } from './supabase.ts'

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null))

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a YYYY-MM-DD date')
  .refine((v) => !Number.isNaN(Date.parse(v)), 'Invalid date')
  .refine((v) => new Date(v) <= new Date(Date.now() + 36 * 3600 * 1000), 'The date cannot be in the future')

const IDENTIFIER_TYPES = ['NIC', 'STUDENT_ID', 'PASSPORT', 'SERIAL_NUMBER', 'IMEI', 'VEHICLE_REGISTRATION', 'OTHER'] as const

const itemFields = {
  title: z.string().trim().min(1, 'Title is required').max(150),
  description: z.string().trim().min(1, 'Description is required').max(2000),
  category_id: z.uuid('Choose a category'),
  location_id: z.uuid('Choose a location'),
  brand: optionalText(80),
  model: optionalText(80),
  color: optionalText(40),
  identifier_type: z.enum(IDENTIFIER_TYPES).optional().nullable(),
  identifier_value: optionalText(100),
}

export const lostItemInput = z
  .object({
    ...itemFields,
    date_lost: isoDate,
    private_ownership_info: optionalText(1000),
  })
  .refine((v) => !v.identifier_value || v.identifier_type, {
    path: ['identifier_type'],
    message: 'Choose the identifier type',
  })

export const foundItemInput = z
  .object({
    ...itemFields,
    date_found: isoDate,
    collection_point_id: z.uuid().optional().nullable(),
  })
  .refine((v) => !v.identifier_value || v.identifier_type, {
    path: ['identifier_type'],
    message: 'Choose the identifier type',
  })

export function parseOrThrow<T extends z.ZodType>(schema: T, body: unknown): z.infer<T> {
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    const first = parsed.error.issues[0]
    throw new HttpError(400, first ? `${first.path.join('.') || 'input'}: ${first.message}` : 'Invalid input')
  }
  return parsed.data
}

/**
 * Ask the Matching Engine (M3) to embed + match a newly created/updated
 * item. Fire-and-forget: a missing or failing matcher never blocks a report.
 */
export async function requestMatching(itemType: 'lost' | 'found', itemId: string): Promise<void> {
  try {
    const res = await fetch(`${env('SUPABASE_URL')}/functions/v1/find-matches`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env('SUPABASE_SERVICE_ROLE_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ item_type: itemType, item_id: itemId }),
    })
    if (!res.ok && res.status !== 404) console.warn('find-matches returned', res.status)
    await res.body?.cancel()
  } catch (err) {
    console.warn('find-matches unavailable:', err instanceof Error ? err.message : err)
  }
}
