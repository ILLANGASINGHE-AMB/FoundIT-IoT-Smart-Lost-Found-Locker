export type ReportKind = 'lost-items' | 'found-items'

export async function uploadItemPhoto(
  kind: ReportKind,
  reportId: string,
  photo: File
): Promise<void> {
  const formData = new FormData()
  formData.append('photo', photo)

  const response = await fetch(
    `http://127.0.0.1:3001/api/${kind}/${encodeURIComponent(reportId)}/images`,
    {
      method: 'POST',
      body: formData,
    }
  )

  if (!response.ok) {
    const error = await response.json().catch(() => null)
    throw new Error(error?.message || 'Could not upload the photo')
  }
}

export type ItemImage = {
  id: string
  created_at: string
  url: string
}

export async function getItemImages(
  kind: ReportKind,
  reportId: string
): Promise<ItemImage[]> {
  const response = await fetch(
    `http://127.0.0.1:3001/api/${kind}/${encodeURIComponent(reportId)}/images`
  )

  if (!response.ok) {
    throw new Error('Could not load photos')
  }

  const photos: ItemImage[] = await response.json()

  return photos.map((photo) => ({
    ...photo,
    url: `http://127.0.0.1:3001${photo.url}`,
  }))
}