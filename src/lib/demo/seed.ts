// Demo mode — seed data (mirrors supabase/seed.sql plus demo accounts and
// a few months of history so every screen has something to show).

import { hashPassword } from './auth'
import { hashClaimCode, runMatching } from './engine'
import { TABLES, Tx, type Row, type Tables } from './store'

export const DEMO_ACCOUNTS = [
  { email: 'alex@foundit.demo', password: 'Demo@1234', name: 'Alex Perera', role: 'user', note: 'Lost a calculator — has an open match' },
  { email: 'sam@foundit.demo', password: 'Demo@1234', name: 'Sam Fernando', role: 'user', note: 'Finder who handed items in' },
  { email: 'admin@foundit.demo', password: 'Admin@1234', name: 'Ada Admin', role: 'admin', note: 'Admin + collection officer' },
] as const

/** Claim credential for Alex's lost calculator (for trying the claim flow). */
export const DEMO_CLAIM_CODE = 'FND-7K4P-92XQ-M3TA'
export const DEMO_PRIVATE_DETAIL = 'Small scratch beside the AC button'

const day = 86400_000
const ago = (days: number) => new Date(Date.now() - days * day).toISOString()
const dateAgo = (days: number) => ago(days).slice(0, 10)

export async function seedDemo(): Promise<Tables> {
  const db: Tables = Object.fromEntries(TABLES.map((t) => [t, []]))
  const tx = new Tx(db, [])

  // ── Lookups ──
  const categories = [
    'Electronics', 'Documents', 'Books', 'Stationery', 'Bags', 'Clothing', 'Keys', 'Accessories',
    'Water Bottles & Umbrellas', 'Other',
  ].map((name) => tx.insert('categories', { name, description: null }))
  const cat = (name: string) => categories.find((c) => c.name === name)!.id

  const locations = [
    ['University Library', 'Library Complex', 'Central'],
    ['Lecture Hall A', 'Main Building', 'Central'],
    ['Lecture Hall B', 'Main Building', 'Central'],
    ['Faculty of Technology - Building A', 'Building A', 'Technology'],
    ['Computer Lab 1', 'IT Centre', 'Technology'],
    ['Main Canteen', 'Student Centre', 'Central'],
    ['Student Centre', 'Student Centre', 'Central'],
    ['Sports Complex', 'Gymnasium', 'Sports'],
    ['Main Gate & Car Park', null, 'Entrance'],
    ['Bus Stop', null, 'Entrance'],
  ].map(([name, building, campus_zone]) => tx.insert('locations', { name, building, campus_zone }))
  const loc = (name: string) => locations.find((l) => l.name === name)!.id

  const library = tx.insert('collection_points', {
    name: 'University Library FoundIT Box',
    location_id: loc('University Library'),
    address: 'Ground floor, next to the issue desk',
    description: 'Staffed 8am–6pm on weekdays',
    contact: 'library-desk@foundit.app',
    qr_slug: 'lib-7k4p92',
  })
  const studentCentre = tx.insert('collection_points', {
    name: 'Student Centre FoundIT Box',
    location_id: loc('Student Centre'),
    address: 'Help desk, Student Centre lobby',
    description: 'Staffed 9am–5pm on weekdays',
    contact: 'studentcentre@foundit.app',
    qr_slug: 'stc-x3m8q1',
  })
  tx.insert('collection_points', {
    name: 'Faculty of Technology FoundIT Box',
    location_id: loc('Faculty of Technology - Building A'),
    address: 'Building A reception',
    description: 'Staffed 8:30am–4:30pm on weekdays',
    contact: 'tech-office@foundit.app',
    qr_slug: 'fot-9vd2ke',
  })

  // ── Accounts ──
  const users: Record<string, Row> = {}
  for (const a of DEMO_ACCOUNTS) {
    const auth = tx.insert('auth_users', {
      email: a.email,
      password_hash: await hashPassword(a.password),
      email_confirmed_at: ago(120),
      user_metadata: { full_name: a.name },
      created_at: ago(120),
    })
    users[a.email] = tx.insert('profiles', {
      id: auth.id,
      email: a.email,
      full_name: a.name,
      role: a.role,
      is_collection_officer: a.role === 'admin',
      phone: a.role === 'admin' ? null : '+94 77 123 4567',
      created_at: ago(120),
    })
  }
  const alex = users['alex@foundit.demo'].id as string
  const sam = users['sam@foundit.demo'].id as string
  const admin = users['admin@foundit.demo'].id as string

  // ── History for analytics (resolved case ~2 months ago) ──
  const oldLost = tx.insert('lost_items', {
    user_id: sam, category_id: cat('Bags'), location_id: loc('Main Canteen'),
    title: 'Grey backpack', description: 'Grey North Face backpack with a laptop sleeve',
    brand: 'North Face', color: 'Grey', date_lost: dateAgo(64), status: 'RESOLVED', created_at: ago(64),
  })
  const oldFound = tx.insert('found_items', {
    finder_id: alex, category_id: cat('Bags'), location_id: loc('Main Canteen'),
    title: 'Backpack', description: 'Grey backpack left under a canteen table', brand: 'North Face', color: 'Grey',
    date_found: dateAgo(63), status: 'RETURNED', collection_point_id: studentCentre.id, created_at: ago(63),
  })
  const oldMatch = tx.insert('match_candidates', {
    lost_item_id: oldLost.id, found_item_id: oldFound.id, score: 88.5, status: 'CONVERTED_TO_CLAIM', created_at: ago(63),
  })
  const oldClaim = tx.insert('claims', {
    match_candidate_id: oldMatch.id, lost_item_id: oldLost.id, found_item_id: oldFound.id, claimant_id: sam,
    status: 'COMPLETED', collection_point_id: studentCentre.id, submitted_at: ago(62), approved_at: ago(61),
    reviewed_at: ago(61), reviewed_by: admin, completed_at: ago(60), created_at: ago(62),
  })
  tx.insert('collections', { claim_id: oldClaim.id, collected_by: admin, collected_at: ago(60) })

  const historic: [string, string, string, number, string][] = [
    ['Black umbrella', 'Water Bottles & Umbrellas', 'Bus Stop', 40, 'found'],
    ['Library book: Data Structures', 'Books', 'University Library', 33, 'found'],
    ['Silver house keys', 'Keys', 'Main Gate & Car Park', 25, 'lost'],
    ['Blue hoodie', 'Clothing', 'Sports Complex', 18, 'found'],
    ['Wired earphones', 'Electronics', 'Computer Lab 1', 12, 'lost'],
  ]
  for (const [title, category, location, days, kind] of historic) {
    if (kind === 'lost') {
      tx.insert('lost_items', {
        user_id: admin, category_id: cat(category), location_id: loc(location), title,
        description: `${title} — reported for the demo history`, date_lost: dateAgo(days), created_at: ago(days),
      })
    } else {
      tx.insert('found_items', {
        finder_id: sam, category_id: cat(category), location_id: loc(location), title,
        description: `${title} handed in at the desk`, date_found: dateAgo(days), created_at: ago(days),
        status: 'IN_STORAGE', collection_point_id: library.id,
      })
    }
  }

  // ── The live scenario: Alex lost a calculator, Sam found one ──
  const calc = tx.insert('lost_items', {
    user_id: alex, category_id: cat('Electronics'), location_id: loc('Lecture Hall A'),
    title: 'Casio scientific calculator', description: 'Black Casio fx-991ES PLUS calculator with a grey slide cover',
    brand: 'Casio', model: 'fx-991ES PLUS', color: 'Black', date_lost: dateAgo(2), created_at: ago(2),
  })
  tx.insert('lost_item_private', { lost_item_id: calc.id, private_ownership_info: DEMO_PRIVATE_DETAIL })
  tx.insert('lost_item_secrets', { lost_item_id: calc.id, claim_code_hash: await hashClaimCode(DEMO_CLAIM_CODE), code_issued_at: ago(2) })

  const foundCalc = tx.insert('found_items', {
    finder_id: sam, category_id: cat('Electronics'), location_id: loc('Lecture Hall A'),
    title: 'Calculator', description: 'Casio scientific calculator, black, found on a desk after the lecture',
    brand: 'casio', model: 'fx-991ES', color: 'Black', date_found: dateAgo(1), created_at: ago(1),
    status: 'IN_STORAGE', collection_point_id: library.id,
  })

  const bottle = tx.insert('lost_items', {
    user_id: alex, category_id: cat('Water Bottles & Umbrellas'), location_id: loc('Sports Complex'),
    title: 'Blue water bottle', description: 'Blue steel water bottle with stickers', color: 'Blue',
    date_lost: dateAgo(5), created_at: ago(5),
  })
  tx.insert('lost_item_private', { lost_item_id: bottle.id, private_ownership_info: 'Sticker of a cat on the bottom' })
  tx.insert('lost_item_secrets', { lost_item_id: bottle.id, claim_code_hash: await hashClaimCode('FND-W8TR-B3QZ-H6NA'), code_issued_at: ago(5) })

  for (const c of runMatching(tx, 'found', foundCalc.id as string)) {
    tx.insert('notifications', {
      user_id: c.owner_id, type: 'MATCH', title: 'Your lost item may have been found',
      message: `A found item is a ${Math.round(c.score as number)}% match for “${c.lost_title}”. Review it to see if it’s yours.`,
      link: `/matches/${c.id}`, created_at: ago(1),
    })
  }
  tx.insert('notifications', {
    user_id: alex, type: 'SYSTEM', title: 'Welcome to FoundIT (demo)',
    message: 'This is demo mode: everything is stored in your browser. Try claiming the calculator match!',
    link: '/matches', is_read: false, created_at: ago(1),
  })
  tx.insert('audit_logs', { action: 'CREATED_FOUND_ITEM', entity_type: 'found_item', entity_id: foundCalc.id, user_id: sam, created_at: ago(1) })
  tx.insert('audit_logs', { action: 'CREATED_LOST_ITEM', entity_type: 'lost_item', entity_id: calc.id, user_id: alex, created_at: ago(2) })

  return db
}
