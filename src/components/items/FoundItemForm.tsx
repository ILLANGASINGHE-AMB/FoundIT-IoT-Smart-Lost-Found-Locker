import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { getCategories, getLocations } from '../../services/itemLookups'
import type { LookupOption } from '../../services/itemLookups'
import { createFoundItem } from '../../services/foundItems'

const fieldStyle = {
  display: 'block',
  width: '100%',
  padding: '10px',
}

export function FoundItemForm() {
  const [categories, setCategories] = useState<LookupOption[]>([])
  const [locations, setLocations] = useState<LookupOption[]>([])
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [locationId, setLocationId] = useState('')
  const [dateFound, setDateFound] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    let active = true

    async function loadOptions() {
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
            'Could not load options. Check that the backend is running.'
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
  }, [])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (saving) return

    setSaveError('')
    setSuccess('')

    if (!title.trim() || !description.trim()) {
      setSaveError('Enter a title and description, not just spaces.')
      return
    }

    setSaving(true)

    try {
      await createFoundItem({
        title: title.trim(),
        description: description.trim(),
        category_id: categoryId,
        location_id: locationId,
        date_found: dateFound,
      })

      setSuccess('Your found report was saved successfully.')
      setTitle('')
      setDescription('')
      setCategoryId('')
      setLocationId('')
      setDateFound('')
    } catch (error) {
      setSaveError(
        error instanceof Error ? error.message : 'Could not save the report'
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <section>
      <h2>Report a found item</h2>

      {loading && <p role="status">Loading options...</p>}
      {loadError && <p role="alert">{loadError}</p>}

      {!loading && !loadError && (
        <form onSubmit={handleSubmit} style={{ maxWidth: '480px' }}>
          <fieldset
            disabled={saving}
            style={{
              display: 'grid',
              gap: '16px',
              border: 0,
              padding: 0,
              margin: 0,
              minWidth: 0,
            }}
          >
            <label htmlFor="found-title">
              Item title
              <input
                id="found-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Example: Blue water bottle"
                required
                maxLength={150}
                style={fieldStyle}
              />
            </label>

            <label htmlFor="found-description">
              Description
              <textarea
                id="found-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Describe the item and where you found it"
                required
                maxLength={2000}
                rows={4}
                style={fieldStyle}
              />
            </label>

            <label htmlFor="found-date">
              Date found
              <input
                id="found-date"
                type="date"
                value={dateFound}
                onChange={(event) => setDateFound(event.target.value)}
                required
                style={fieldStyle}
              />
            </label>

            <label htmlFor="found-category">
              Category
              <select
                id="found-category"
                value={categoryId}
                onChange={(event) => setCategoryId(event.target.value)}
                required
                style={fieldStyle}
              >
                <option value="">Select a category</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>

            <label htmlFor="found-location">
              Location where you found it
              <select
                id="found-location"
                value={locationId}
                onChange={(event) => setLocationId(event.target.value)}
                required
                style={fieldStyle}
              >
                <option value="">Select a location</option>
                {locations.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.name}
                  </option>
                ))}
              </select>
            </label>

            <button type="submit" style={{ padding: '12px' }}>
              {saving ? 'Saving...' : 'Save found report'}
            </button>
          </fieldset>

          {saveError && <p role="alert">{saveError}</p>}
          {success && <p role="status">{success}</p>}
        </form>
      )}
    </section>
  )
}