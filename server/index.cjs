require('dotenv').config()

const express = require('express')
const cors = require('cors')
const { Pool } = require('pg')
const { z } = require('zod')
const multer = require('multer')
const sharp = require('sharp')
const path = require('node:path')
const fs = require('node:fs/promises')
const { randomUUID } = require('node:crypto')
const app = express()

const pool = new Pool({
  connectionTimeoutMillis: 5000,
})

app.use(cors({ origin: 'http://localhost:5173' }))
app.use(express.json())

const uploadsDirectory = path.join(__dirname, 'uploads')

const acceptedImageTypes = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
])

const uploadPhoto = multer({
  storage: multer.memoryStorage(),

  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 1,
    fields: 0,
    parts: 1,
  },

  fileFilter: (req, file, callback) => {
    if (!acceptedImageTypes.has(file.mimetype)) {
      return callback(
        new Error('Please choose a JPEG, PNG, or WebP image')
      )
    }

    callback(null, true)
  },
})

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
        l.name AS location,
        (
          SELECT img.id
          FROM public.item_images AS img
          WHERE img.lost_item_id = li.id
          ORDER BY img.created_at ASC, img.id ASC
          LIMIT 1
        ) AS image_id
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
         l.name AS location,
          (
            SELECT img.id
            FROM public.item_images AS img
            WHERE img.found_item_id = fi.id
            ORDER BY img.created_at ASC, img.id ASC
            LIMIT 1
          ) AS image_id
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

app.post('/api/:kind/:id/images', async (req, res) => {
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

  // Only these two report types are accepted.
  const reportTypes = {
    'lost-items': {
      table: 'lost_items',
      owner: 'user_id',
      imageColumn: 'lost_item_id',
      editableStatus: 'LOST',
    },
    'found-items': {
      table: 'found_items',
      owner: 'finder_id',
      imageColumn: 'found_item_id',
      editableStatus: 'FOUND',
    },
  }

  if (!Object.hasOwn(reportTypes, req.params.kind)) {
    return res.status(404).json({
      message: 'Unknown report type',
    })
  }

  const config = reportTypes[req.params.kind]

  try {
    const report = await pool.query(
      `SELECT status
       FROM public.${config.table}
       WHERE id = $1 AND ${config.owner} = $2`,
      [itemId.data, userId.data]
    )

    if (report.rows.length === 0) {
      return res.status(404).json({
        message: 'Report not found',
      })
    }

    if (report.rows[0].status !== config.editableStatus) {
      return res.status(409).json({
        message: 'Photos cannot be added to this report in its current status',
      })
    }
  } catch (error) {
    console.error('Could not check report:', error.message)

    return res.status(500).json({
      message: 'Could not check the report',
    })
  }

  uploadPhoto.single('photo')(req, res, async (uploadError) => {
    if (uploadError) {
      return res.status(400).json({
        message:
          uploadError.code === 'LIMIT_FILE_SIZE'
            ? 'Photo must be 5 MB or smaller'
            : 'Upload one JPEG, PNG, or WebP photo, up to 5 MB',
      })
    }

    if (!req.file) {
      return res.status(400).json({
        message: 'Please select a photo',
      })
    }

    let imageBuffer

    try {
      const image = sharp(req.file.buffer, {
        limitInputPixels: 25000000,
      })

      const metadata = await image.metadata()

      if (
        !['jpeg', 'png', 'webp'].includes(metadata.format) ||
        (metadata.pages || 1) > 1
      ) {
        return res.status(400).json({
          message: 'Choose a non-animated JPEG, PNG, or WebP image',
        })
      }

      imageBuffer = await image
        .rotate()
        .resize({
          width: 1600,
          height: 1600,
          fit: 'inside',
          withoutEnlargement: true,
        })
        .webp({ quality: 80 })
        .toBuffer()
    } catch {
      return res.status(400).json({
        message: 'The image is damaged, unsupported, or too large in dimensions',
      })
    }

    const filename = `${randomUUID()}.webp`
    const filePath = path.join(uploadsDirectory, filename)
    let fileWritten = false

    try {
      await fs.mkdir(uploadsDirectory, { recursive: true })
      await fs.writeFile(filePath, imageBuffer, { flag: 'wx' })
      fileWritten = true

      const result = await pool.query(
        `INSERT INTO public.item_images (
           ${config.imageColumn},
           uploader_id,
           storage_path
         )
         VALUES ($1, $2, $3)
         RETURNING id, created_at`,
        [itemId.data, userId.data, filename]
      )

      return res.status(201).json({
        ...result.rows[0],
        message: 'Photo uploaded successfully',
      })
    } catch (error) {
      // Remove the file if saving its database record failed.
      if (fileWritten) {
        await fs.unlink(filePath).catch((cleanupError) => {
          console.error('Photo cleanup failed:', cleanupError.message)
        })
      }

      console.error('Could not save photo:', error.message)

      return res.status(500).json({
        message: 'Could not save the photo',
      })
    }
  })
})

app.get('/api/:kind/:id/images', async (req, res) => {
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

  const reportTypes = {
    'lost-items': {
      table: 'lost_items',
      owner: 'user_id',
      imageColumn: 'lost_item_id',
    },
    'found-items': {
      table: 'found_items',
      owner: 'finder_id',
      imageColumn: 'found_item_id',
    },
  }

  if (!Object.hasOwn(reportTypes, req.params.kind)) {
    return res.status(404).json({
      message: 'Unknown report type',
    })
  }

  const config = reportTypes[req.params.kind]

  try {
    const report = await pool.query(
      `SELECT id FROM public.${config.table}
       WHERE id = $1 AND ${config.owner} = $2`,
      [itemId.data, userId.data]
    )

    if (report.rows.length === 0) {
      return res.status(404).json({
        message: 'Report not found',
      })
    }

    const result = await pool.query(
      `SELECT id, created_at
       FROM public.item_images
       WHERE ${config.imageColumn} = $1
       ORDER BY created_at ASC`,
      [itemId.data]
    )

    return res.json(
      result.rows.map((photo) => ({
        ...photo,
        url: `/api/images/${photo.id}`,
      }))
    )
  } catch (error) {
    console.error('Could not load photos:', error.message)

    return res.status(500).json({
      message: 'Could not load photos',
    })
  }
})

app.get('/api/images/:imageId', async (req, res) => {
  if (
    process.env.LOCAL_DEMO_MODE !== 'true' ||
    process.env.NODE_ENV === 'production'
  ) {
    return res.status(403).json({
      message: 'Local demo mode is disabled',
    })
  }

  const userId = z.uuid().safeParse(process.env.DEV_USER_ID)
  const imageId = z.uuid().safeParse(req.params.imageId)

  if (!userId.success) {
    return res.status(500).json({
      message: 'The local test user is not configured',
    })
  }

  if (!imageId.success) {
    return res.status(400).json({
      message: 'Invalid photo ID',
    })
  }

  try {
    const result = await pool.query(
      `SELECT img.storage_path
       FROM public.item_images AS img
       LEFT JOIN public.lost_items AS li
         ON li.id = img.lost_item_id
       LEFT JOIN public.found_items AS fi
         ON fi.id = img.found_item_id
       WHERE img.id = $1
         AND (li.user_id = $2 OR fi.finder_id = $2)`,
      [imageId.data, userId.data]
    )

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: 'Photo not found',
      })
    }

    const filename = result.rows[0].storage_path

    // Only serve filenames generated by our upload endpoint.
    if (!/^[0-9a-f-]{36}\.webp$/i.test(filename)) {
      return res.status(404).json({
        message: 'Photo not found',
      })
    }

    res.set('Cache-Control', 'private, no-store')
    res.set('X-Content-Type-Options', 'nosniff')

    return res.sendFile(
      filename,
      { root: uploadsDirectory },
      (error) => {
        if (error && !res.headersSent) {
          res.status(404).json({
            message: 'Photo file not found',
          })
        }
      }
    )
  } catch (error) {
    console.error('Could not read photo:', error.message)

    return res.status(500).json({
      message: 'Could not read the photo',
    })
  }
})


const port = Number(process.env.PORT || 3001)

app.listen(port, '127.0.0.1', () => {
  console.log(`Backend running at http://127.0.0.1:${port}`)
})