require('dotenv').config()

const express = require('express')
const cors = require('cors')
const { Pool } = require('pg')
const { z } = require('zod')

const app = express()

const pool = new Pool({
  connectionTimeoutMillis: 5000,
})

app.use(cors({ origin: 'http://localhost:5173' }))
app.use(express.json())

app.get('/api/categories', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name FROM public.categories ORDER BY name'
    )

    res.json(result.rows)
  } catch (error) {
    console.error('Could not load categories:', error.message)

    res.status(500).json({
      message: 'Could not load categories',
    })
  }
})

app.get('/api/locations', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name FROM public.locations ORDER BY name'
    )

    res.json(result.rows)
  } catch (error) {
    console.error('Could not load locations:', error.message)

    res.status(500).json({
      message: 'Could not load locations',
    })
  }
})


//Zod checks the required text, UUIDs, and date before we attempt to save

const lostItemSchema = z.object({
  title: z.string().trim().min(1).max(150),
  description: z.string().trim().min(1).max(2000),
  category_id: z.uuid(),
  location_id: z.uuid(),
  date_lost: z.iso.date(),
})

app.post('/api/lost-items', async (req, res) => {
  // Temporary local testing only.
  if (
    process.env.LOCAL_DEMO_MODE !== 'true' ||
    process.env.NODE_ENV === 'production'
  ) {
    return res.status(403).json({
      message: 'Local demo mode is disabled',
    })
  }

  const userId = z.uuid().safeParse(process.env.DEV_USER_ID)

  if (!userId.success) {
    return res.status(500).json({
      message: 'The local test user is not configured',
    })
  }

  const parsed = lostItemSchema.safeParse(req.body)

  if (!parsed.success) {
    return res.status(400).json({
      message: 'Please check your report fields',
      errors: parsed.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      })),
    })
  }

  const item = parsed.data

  try {
    const result = await pool.query(
      `INSERT INTO public.lost_items (
        user_id, title, description,
        category_id, location_id, date_lost
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, title, status`,
      [
        userId.data,
        item.title,
        item.description,
        item.category_id,
        item.location_id,
        item.date_lost,
      ]
    )

    return res.status(201).json(result.rows[0])
  } catch (error) {
    if (error.code === '23503') {
      return res.status(400).json({
        message: 'Choose an existing category and location',
      })
    }

    console.error('Could not save lost report:', error.message)

    return res.status(500).json({
      message: 'Could not save the report',
    })
  }
})


//This retrieves the latest 100 lost reports belonging to our local test user, 
//including readable category and location names.

app.get('/api/lost-items', async (req, res) => {
  if (
    process.env.LOCAL_DEMO_MODE !== 'true' ||
    process.env.NODE_ENV === 'production'
  ) {
    return res.status(403).json({
      message: 'Local demo mode is disabled',
    })
  }

  const userId = z.uuid().safeParse(process.env.DEV_USER_ID)

  if (!userId.success) {
    return res.status(500).json({
      message: 'The local test user is not configured',
    })
  }

  try {
    const result = await pool.query(
      `SELECT
         li.id,
         li.title,
         li.status,
         li.created_at,
         TO_CHAR(li.date_lost, 'YYYY-MM-DD') AS date_lost,
         c.name AS category,
         l.name AS location
       FROM public.lost_items AS li
       JOIN public.categories AS c ON c.id = li.category_id
       JOIN public.locations AS l ON l.id = li.location_id
       WHERE li.user_id = $1
       ORDER BY li.created_at DESC
       LIMIT 100`,
      [userId.data]
    )

    res.json(result.rows)
  } catch (error) {
    console.error('Could not load lost reports:', error.message)

    res.status(500).json({
      message: 'Could not load lost reports',
    })
  }
})

//:id identifies the report to open

app.get('/api/lost-items/:id', async (req, res) => {
  if (
    process.env.LOCAL_DEMO_MODE !== 'true' ||
    process.env.NODE_ENV === 'production'
  ) {
    return res.status(403).json({
      message: 'Local demo mode is disabled',
    })
  }

  const userId = z.uuid().safeParse(process.env.DEV_USER_ID)
  const itemId = z.uuid().safeParse(req.params.id)

  if (!userId.success) {
    return res.status(500).json({
      message: 'The local test user is not configured',
    })
  }

  if (!itemId.success) {
    return res.status(400).json({
      message: 'Invalid report ID',
    })
  }

  try {
    const result = await pool.query(
      `SELECT
         li.id,
         li.title,
         li.description,
         li.brand,
         li.model,
         li.color,
         li.status,
         li.category_id,
         li.location_id,
         TO_CHAR(li.date_lost, 'YYYY-MM-DD') AS date_lost,
         li.created_at,
         li.updated_at,
         c.name AS category,
         l.name AS location
       FROM public.lost_items AS li
       JOIN public.categories AS c ON c.id = li.category_id
       JOIN public.locations AS l ON l.id = li.location_id
       WHERE li.id = $1 AND li.user_id = $2`,
      [itemId.data, userId.data]
    )

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: 'Report not found',
      })
    }

    res.json(result.rows[0])
  } catch (error) {
    console.error('Could not load report details:', error.message)

    res.status(500).json({
      message: 'Could not load report details',
    })
  }
})


app.patch('/api/lost-items/:id/cancel', async (req, res) => {
  if (
    process.env.LOCAL_DEMO_MODE !== 'true' ||
    process.env.NODE_ENV === 'production'
  ) {
    return res.status(403).json({
      message: 'Local demo mode is disabled',
    })
  }

  const userId = z.uuid().safeParse(process.env.DEV_USER_ID)
  const itemId = z.uuid().safeParse(req.params.id)

  if (!userId.success) {
    return res.status(500).json({
      message: 'The local test user is not configured',
    })
  }

  if (!itemId.success) {
    return res.status(400).json({
      message: 'Invalid report ID',
    })
  }

  try {
    const result = await pool.query(
      `UPDATE public.lost_items
       SET status = 'CANCELLED'
       WHERE id = $1
         AND user_id = $2
         AND status = 'LOST'
       RETURNING id, status, updated_at`,
      [itemId.data, userId.data]
    )

    if (result.rows.length === 0) {
      return res.status(409).json({
        message: 'This report is unavailable or is no longer LOST',
      })
    }

    return res.json(result.rows[0])
  } catch (error) {
    console.error('Could not cancel report:', error.message)

    return res.status(500).json({
      message: 'Could not cancel the report',
    })
  }
})


const foundItemSchema = z.object({
  title: z.string().trim().min(1).max(150),
  description: z.string().trim().min(1).max(2000),
  category_id: z.uuid(),
  location_id: z.uuid(),
  date_found: z.iso.date(),
})

app.post('/api/found-items', async (req, res) => {
  if (
    process.env.LOCAL_DEMO_MODE !== 'true' ||
    process.env.NODE_ENV === 'production'
  ) {
    return res.status(403).json({
      message: 'Local demo mode is disabled',
    })
  }

  const finderId = z.uuid().safeParse(process.env.DEV_USER_ID)

  if (!finderId.success) {
    return res.status(500).json({
      message: 'The local test user is not configured',
    })
  }

  const parsed = foundItemSchema.safeParse(req.body)

  if (!parsed.success) {
    return res.status(400).json({
      message: 'Please check your report fields',
      errors: parsed.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      })),
    })
  }

  const item = parsed.data

  try {
    const result = await pool.query(
      `INSERT INTO public.found_items (
         finder_id,
         title,
         description,
         category_id,
         location_id,
         date_found
       )
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, title, status`,
      [
        finderId.data,
        item.title,
        item.description,
        item.category_id,
        item.location_id,
        item.date_found,
      ]
    )

    return res.status(201).json(result.rows[0])
  } catch (error) {
    if (error.code === '23503') {
      return res.status(400).json({
        message: 'Choose an existing category and location',
      })
    }

    console.error('Could not save found report:', error.message)

    return res.status(500).json({
      message: 'Could not save the found report',
    })
  }
})


app.get('/api/found-items/:id', async (req, res) => {
  if (
    process.env.LOCAL_DEMO_MODE !== 'true' ||
    process.env.NODE_ENV === 'production'
  ) {
    return res.status(403).json({
      message: 'Local demo mode is disabled',
    })
  }

  const finderId = z.uuid().safeParse(process.env.DEV_USER_ID)
  const itemId = z.uuid().safeParse(req.params.id)

  if (!finderId.success) {
    return res.status(500).json({
      message: 'The local test user is not configured',
    })
  }

  if (!itemId.success) {
    return res.status(400).json({
      message: 'Invalid report ID',
    })
  }

  try {
    const result = await pool.query(
      `SELECT
         fi.id,
         fi.title,
         fi.description,
         fi.brand,
         fi.model,
         fi.color,
         fi.status,
         fi.category_id,
         fi.location_id,
         TO_CHAR(fi.date_found, 'YYYY-MM-DD') AS date_found,
         fi.created_at,
         fi.updated_at,
         c.name AS category,
         l.name AS location
       FROM public.found_items AS fi
       JOIN public.categories AS c ON c.id = fi.category_id
       JOIN public.locations AS l ON l.id = fi.location_id
       WHERE fi.id = $1 AND fi.finder_id = $2`,
      [itemId.data, finderId.data]
    )

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: 'Report not found',
      })
    }

    return res.json(result.rows[0])
  } catch (error) {
    console.error('Could not load found report details:', error.message)

    return res.status(500).json({
      message: 'Could not load found report details',
    })
  }
})

app.get('/api/found-items', async (req, res) => {
  if (
    process.env.LOCAL_DEMO_MODE !== 'true' ||
    process.env.NODE_ENV === 'production'
  ) {
    return res.status(403).json({
      message: 'Local demo mode is disabled',
    })
  }

  const finderId = z.uuid().safeParse(process.env.DEV_USER_ID)

  if (!finderId.success) {
    return res.status(500).json({
      message: 'The local test user is not configured',
    })
  }

  try {
    const result = await pool.query(
      `SELECT
         fi.id,
         fi.title,
         fi.status,
         TO_CHAR(fi.date_found, 'YYYY-MM-DD') AS date_found,
         fi.created_at,
         c.name AS category,
         l.name AS location
       FROM public.found_items AS fi
       JOIN public.categories AS c ON c.id = fi.category_id
       JOIN public.locations AS l ON l.id = fi.location_id
       WHERE fi.finder_id = $1
       ORDER BY fi.created_at DESC
       LIMIT 100`,
      [finderId.data]
    )

    return res.json(result.rows)
  } catch (error) {
    console.error('Could not load found reports:', error.message)

    return res.status(500).json({
      message: 'Could not load found reports',
    })
  }
})

const port = Number(process.env.PORT || 3001)

app.listen(port, '127.0.0.1', () => {
  console.log(`Backend running at http://127.0.0.1:${port}`)
})