import { useEffect, useId, useRef, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { getCategories, getLocations } from '../../services/itemLookups'
import type { LookupOption } from '../../services/itemLookups'
import { createLostItem } from '../../services/lostItems'
import { createFoundItem } from '../../services/foundItems'
import { uploadItemPhoto } from '../../services/itemImages'
import './ReportCreateForm.css'

type Photo = {
  id: string
  file: File
  preview: string
  status: 'ready' | 'uploading' | 'uploaded' | 'failed'
  error?: string
}

type SavedReport = {
  id: string
  claimCode?: string
}

const emptyFields = {
  title: '',
  description: '',
  category_id: '',
  location_id: '',
  date: '',
}

export function ReportCreateForm({
  kind,
}: {
  kind: 'lost' | 'found'
}) {
  const prefix = useId()

  const [fields, setFields] = useState(emptyFields)
  const [categories, setCategories] = useState<LookupOption[]>([])
  const [locations, setLocations] = useState<LookupOption[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [loadVersion, setLoadVersion] = useState(0)

  const [photos, setPhotos] = useState<Photo[]>([])
  const [saved, setSaved] = useState<SavedReport | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [selectionError, setSelectionError] = useState('')
  const [progress, setProgress] = useState('')

  const lock = useRef(false)
  const previewUrls = useRef(new Set<string>())

  useEffect(() => {
    let active = true

    async function loadOptions() {
      setLoading(true)
      setLoadError('')

      try {
        const [categoryData, locationData] = await Promise.all([
          getCategories(),
          getLocations(),
        ])

        if (active) {
          setCategories(categoryData)
          setLocations(locationData)
        }
      } catch {
        if (active) {
          setLoadError(
            'Could not load categories and locations. Check your backend.'
          )
        }
      } finally {
        if (active) setLoading(false)
      }
    }

    void loadOptions()

    return () => {
      active = false
    }
  }, [loadVersion])

  // Release preview URLs when this component is removed.
  useEffect(() => {
    const urls = previewUrls.current

    return () => {
      urls.forEach(url => URL.revokeObjectURL(url))
      urls.clear()
    }
  }, [])

  // Warn before refreshing or closing with pending photos or a claim code.
  useEffect(() => {
    const needsWarning =
      busy ||
      Boolean(saved?.claimCode) ||
      photos.some(photo => photo.status !== 'uploaded')

    if (!needsWarning) return

    function warnBeforeLeaving(event: BeforeUnloadEvent) {
      event.preventDefault()
      event.returnValue = ''
    }

    window.addEventListener('beforeunload', warnBeforeLeaving)

    return () => {
      window.removeEventListener('beforeunload', warnBeforeLeaving)
    }
  }, [busy, saved, photos])

  // Protect pending work when using the dashboard navigation.
  useEffect(() => {
    function guardNavigation(event: MouseEvent) {
      if (!(event.target instanceof Element)) return

      const target = event.target.closest('button, a')

      if (!target || target.closest('.report-create')) return

      // These tabs preserve both mounted forms in ReportItemView.
      if (target.closest('.report-filters')) return

      const needsWarning =
        Boolean(saved?.claimCode) ||
        photos.some(photo => photo.status !== 'uploaded')

      if (busy) {
        event.preventDefault()
        event.stopPropagation()
        return
      }

      if (
        needsWarning &&
        !window.confirm(
          'Leave this page? Save your claim code first. Any pending photo selections will be lost.'
        )
      ) {
        event.preventDefault()
        event.stopPropagation()
      }
    }

    document.addEventListener('click', guardNavigation, true)

    return () => {
      document.removeEventListener('click', guardNavigation, true)
    }
  }, [busy, saved, photos])

  function selectPhotos(event: ChangeEvent<HTMLInputElement>) {
    const additions: Photo[] = []
    const problems: string[] = []

    for (const file of Array.from(event.target.files || [])) {
      const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']

      if (!allowedTypes.includes(file.type)) {
        problems.push(`${file.name}: choose JPEG, PNG, or WebP.`)
        continue
      }

      if (file.size === 0 || file.size > 5 * 1024 * 1024) {
        problems.push(`${file.name}: choose a non-empty file up to 5 MB.`)
        continue
      }

      const alreadySelected = [...photos, ...additions].some(
        photo =>
          photo.file.name === file.name &&
          photo.file.size === file.size &&
          photo.file.lastModified === file.lastModified
      )

      if (alreadySelected) continue

      if (photos.length + additions.length >= 10) {
        problems.push('You can select up to 10 photos per submission.')
        break
      }

      const preview = URL.createObjectURL(file)
      previewUrls.current.add(preview)

      additions.push({
        id: crypto.randomUUID(),
        file,
        preview,
        status: 'ready',
      })
    }

    setPhotos(current => [...current, ...additions])
    setSelectionError(problems.join(' '))

    // Allows selecting the same file again after removing it.
    event.target.value = ''
  }

  function removePhoto(photo: Photo) {
    URL.revokeObjectURL(photo.preview)
    previewUrls.current.delete(photo.preview)

    setPhotos(current => current.filter(item => item.id !== photo.id))
  }

  async function uploadPhotos(
    report: SavedReport,
    pendingPhotos: Photo[]
  ) {
    for (const [index, photo] of pendingPhotos.entries()) {
      setProgress(
        `Uploading photo ${index + 1} of ${pendingPhotos.length}…`
      )

      setPhotos(current =>
        current.map(item =>
          item.id === photo.id
            ? { ...item, status: 'uploading', error: undefined }
            : item
        )
      )

      try {
        await uploadItemPhoto(`${kind}-items`, report.id, photo.file)

        setPhotos(current =>
          current.map(item =>
            item.id === photo.id
              ? { ...item, status: 'uploaded' }
              : item
          )
        )
      } catch (reason) {
        setPhotos(current =>
          current.map(item =>
            item.id === photo.id
              ? {
                  ...item,
                  status: 'failed',
                  error:
                    reason instanceof Error
                      ? reason.message
                      : 'Upload failed',
                }
              : item
          )
        )
      }
    }

    setProgress('')
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (lock.current || saved) return

    if (!fields.title.trim() || !fields.description.trim()) {
      setError('Enter a title and description, not just spaces.')
      return
    }

    lock.current = true
    setBusy(true)
    setError('')
    setProgress('Saving report…')

    try {
      const input = {
        title: fields.title.trim(),
        description: fields.description.trim(),
        category_id: fields.category_id,
        location_id: fields.location_id,
      }

      let report: SavedReport

      if (kind === 'lost') {
        const result = await createLostItem({
          ...input,
          date_lost: fields.date,
        })

        report = {
          id: result.id,
          claimCode: result.claim_code,
        }
      } else {
        const result = await createFoundItem({
          ...input,
          date_found: fields.date,
        })

        report = { id: result.id }
      }

      // Keep the report ID and claim code before starting uploads.
      setSaved(report)

      await uploadPhotos(report, photos)
    } catch (reason) {
      const message =
        reason instanceof Error
          ? reason.message
          : 'Could not save report'

      setError(
        `${message}. If the connection was interrupted, check My Reports before submitting again.`
      )
    } finally {
      lock.current = false
      setBusy(false)
      setProgress('')
    }
  }

  async function retryFailedPhotos() {
    if (lock.current || !saved) return

    lock.current = true
    setBusy(true)

    try {
      const failedPhotos = photos.filter(
        photo => photo.status === 'failed'
      )

      // Reuse the saved report. Do not create another one.
      await uploadPhotos(saved, failedPhotos)
    } finally {
      lock.current = false
      setBusy(false)
    }
  }

  function finish() {
    const hasPendingPhotos = photos.some(
      photo => photo.status !== 'uploaded'
    )

    if (
      (saved?.claimCode || hasPendingPhotos) &&
      !window.confirm(
        'Have you saved your claim code, if shown? Remaining photo selections will be cleared. You can add photos later from report details.'
      )
    ) {
      return
    }

    previewUrls.current.forEach(url => URL.revokeObjectURL(url))
    previewUrls.current.clear()

    setPhotos([])
    setSaved(null)
    setFields(emptyFields)
    setError('')
    setSelectionError('')
  }

  const failedCount = photos.filter(
    photo => photo.status === 'failed'
  ).length

  return (
    <section className="report-create" aria-busy={busy}>
      <h2>
        {saved
          ? `${kind === 'lost' ? 'Lost' : 'Found'} report saved`
          : `Report a ${kind} item`}
      </h2>

      {saved ? (
        <>
          <p>Your report is saved. You can find it in My Reports.</p>

          {saved.claimCode && (
            <div className="report-create-credential">
              <label htmlFor={`${prefix}-claim`}>
                Your private claim code
              </label>

              <input
                id={`${prefix}-claim`}
                value={saved.claimCode}
                readOnly
                autoComplete="off"
                spellCheck={false}
                onFocus={event => event.currentTarget.select()}
              />

              <p>
                Copy and save this code privately. It cannot be
                retrieved later. It stays here while photos upload
                or are retried.
              </p>
            </div>
          )}

          {!busy && failedCount === 0 && (
            <p role="status">
              {photos.length > 0
                ? 'All selected photos uploaded successfully.'
                : 'Report saved without photos. You can add them later.'}
            </p>
          )}

          {failedCount > 0 && (
            <p role="alert">
              Your report is saved, but {failedCount} photo(s) failed.
              Retry those photos below without creating another
              report. If an upload response was lost, check the
              gallery before retrying to avoid a duplicate photo.
            </p>
          )}
        </>
      ) : (
        <>
          {loading && <p role="status">Loading options…</p>}

          {loadError && (
            <div role="alert">
              <p>{loadError}</p>

              <button
                type="button"
                onClick={() => setLoadVersion(value => value + 1)}
              >
                Try again
              </button>
            </div>
          )}
        </>
      )}

      {((!loading && !loadError) || saved) && (
        <form onSubmit={submit}>
          {!saved && (
            <fieldset disabled={busy}>
              <label htmlFor={`${prefix}-title`}>Item title</label>
              <input
                id={`${prefix}-title`}
                required
                maxLength={150}
                value={fields.title}
                onChange={event =>
                  setFields({ ...fields, title: event.target.value })
                }
              />

              <label htmlFor={`${prefix}-description`}>
                Description
              </label>
              <textarea
                id={`${prefix}-description`}
                required
                maxLength={2000}
                rows={4}
                value={fields.description}
                onChange={event =>
                  setFields({
                    ...fields,
                    description: event.target.value,
                  })
                }
              />

              <label htmlFor={`${prefix}-date`}>Date {kind}</label>
              <input
                id={`${prefix}-date`}
                type="date"
                required
                value={fields.date}
                onChange={event =>
                  setFields({ ...fields, date: event.target.value })
                }
              />

              <label htmlFor={`${prefix}-category`}>Category</label>
              <select
                id={`${prefix}-category`}
                required
                value={fields.category_id}
                onChange={event =>
                  setFields({
                    ...fields,
                    category_id: event.target.value,
                  })
                }
              >
                <option value="">Select a category</option>

                {categories.map(category => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>

              <label htmlFor={`${prefix}-location`}>
                {kind === 'lost'
                  ? 'Last seen location'
                  : 'Location where you found it'}
              </label>
              <select
                id={`${prefix}-location`}
                required
                value={fields.location_id}
                onChange={event =>
                  setFields({
                    ...fields,
                    location_id: event.target.value,
                  })
                }
              >
                <option value="">Select a location</option>

                {locations.map(location => (
                  <option key={location.id} value={location.id}>
                    {location.name}
                  </option>
                ))}
              </select>

              <label htmlFor={`${prefix}-photos`}>
                Photos (optional)
              </label>
              <p id={`${prefix}-photo-help`}>
                Select up to 10 JPEG, PNG, or WebP photos, up to
                5 MB each. You can select multiple photos at once.
              </p>
              <input
                id={`${prefix}-photos`}
                type="file"
                multiple
                accept="image/jpeg,image/png,image/webp"
                aria-describedby={`${prefix}-photo-help`}
                onChange={selectPhotos}
              />
            </fieldset>
          )}

          {selectionError && !saved && (
            <p role="alert">{selectionError}</p>
          )}

          <div className="report-create-photos">
            {photos.map(photo => (
              <figure key={photo.id}>
                <img
                  src={photo.preview}
                  alt={`Selected photo: ${photo.file.name}`}
                />

                <figcaption>{photo.file.name}</figcaption>

                {saved && (
                  <p>
                    {photo.status === 'uploaded'
                      ? 'Uploaded'
                      : photo.status === 'uploading'
                        ? 'Uploading…'
                        : photo.status === 'failed'
                          ? 'Upload failed'
                          : 'Waiting'}
                  </p>
                )}

                {photo.error && (
                  <p className="report-create-error">
                    {photo.error}
                  </p>
                )}

                {!busy && photo.status !== 'uploaded' && (
                  <button
                    type="button"
                    onClick={() => removePhoto(photo)}
                    aria-label={`Remove selected photo ${photo.file.name}`}
                  >
                    Remove selection
                  </button>
                )}
              </figure>
            ))}
          </div>

          {error && <p role="alert">{error}</p>}

          <p role="status" aria-live="polite">
            {progress}
          </p>

          {!saved ? (
            <button
              className="report-create-primary"
              type="submit"
              disabled={busy}
            >
              {busy ? 'Saving…' : `Submit ${kind} report`}
            </button>
          ) : (
            <div className="report-create-actions">
              {failedCount > 0 && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void retryFailedPhotos()}
                >
                  Retry failed photos
                </button>
              )}

              <button
                className="report-create-primary"
                type="button"
                disabled={busy}
                onClick={finish}
              >
                {saved.claimCode
                  ? 'I have saved my code — finish'
                  : 'Finish'}
              </button>
            </div>
          )}
        </form>
      )}
    </section>
  )
}