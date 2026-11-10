// Demo mode — Supabase Storage stand-in. Item photos are stored as blobs
// in IndexedDB; avatars are downscaled and kept as data URLs so the
// "public URL" survives a page reload.

const DB_NAME = 'foundit-demo-files'
const STORE = 'files'
const avatarUrls = new Map<string, string>()
const objectUrls = new Map<string, string>()

function idb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function idbRun<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await idb()
  return new Promise((resolve, reject) => {
    const req = fn(db.transaction(STORE, mode).objectStore(STORE))
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function toAvatarDataUrl(file: Blob): Promise<string> {
  const bitmap = await createImageBitmap(file)
  const size = 256
  const scale = Math.max(size / bitmap.width, size / bitmap.height)
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  const w = bitmap.width * scale
  const h = bitmap.height * scale
  ctx.drawImage(bitmap, (size - w) / 2, (size - h) / 2, w, h)
  return canvas.toDataURL('image/jpeg', 0.85)
}

const LIMITS: Record<string, { max: number; types: string[] }> = {
  avatars: { max: 2 * 1024 * 1024, types: ['image/jpeg', 'image/png', 'image/webp'] },
  'item-images': { max: 5 * 1024 * 1024, types: ['image/jpeg', 'image/png', 'image/webp'] },
}

export class DemoBucket {
  private bucket: string
  constructor(bucket: string) {
    this.bucket = bucket
  }

  private key(path: string) {
    return `${this.bucket}/${path}`
  }

  async upload(path: string, file: Blob, options?: { contentType?: string }) {
    const limit = LIMITS[this.bucket]
    const type = options?.contentType ?? file.type
    if (limit && (file.size > limit.max || !limit.types.includes(type))) {
      return { data: null, error: { message: 'The file is too large or not an allowed image type.' } }
    }
    try {
      if (this.bucket === 'avatars') avatarUrls.set(path, await toAvatarDataUrl(file))
      else await idbRun('readwrite', (s) => s.put(file, this.key(path)))
      return { data: { path }, error: null }
    } catch {
      return { data: null, error: { message: 'Could not store the file in this browser.' } }
    }
  }

  getPublicUrl(path: string) {
    return { data: { publicUrl: avatarUrls.get(path) ?? '' } }
  }

  async createSignedUrls(paths: string[]) {
    const data = await Promise.all(
      paths.map(async (path) => {
        const k = this.key(path)
        if (!objectUrls.has(k)) {
          const blob = (await idbRun('readonly', (s) => s.get(k)).catch(() => undefined)) as Blob | undefined
          if (blob) objectUrls.set(k, URL.createObjectURL(blob))
        }
        return { path, signedUrl: objectUrls.get(k) ?? '', error: null }
      }),
    )
    return { data, error: null }
  }

  async remove(paths: string[]) {
    for (const path of paths) {
      const k = this.key(path)
      await idbRun('readwrite', (s) => s.delete(k)).catch(() => undefined)
      const url = objectUrls.get(k)
      if (url) URL.revokeObjectURL(url)
      objectUrls.delete(k)
    }
    return { data: paths.map((name) => ({ name })), error: null }
  }
}

export async function clearDemoFiles() {
  await idbRun('readwrite', (s) => s.clear()).catch(() => undefined)
  objectUrls.forEach((url) => URL.revokeObjectURL(url))
  objectUrls.clear()
}
