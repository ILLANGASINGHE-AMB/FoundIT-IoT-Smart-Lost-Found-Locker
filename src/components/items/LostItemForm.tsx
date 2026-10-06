import { useEffect, useState } from 'react'
import { getCategories, getLocations } from '../../services/itemLookups'
import type { LookupOption } from '../../services/itemLookups'
import type { FormEvent } from 'react'
import { createLostItem } from '../../services/lostItems'

export function LostItemForm() {
  const [categories, setCategories] = useState<LookupOption[]>([])
  const [locations, setLocations] = useState<LookupOption[]>([])
  const [categoryId, setCategoryId] = useState('')
  const [locationId, setLocationId] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [dateLost, setDateLost] = useState('')
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
          setError('Could not load categories and locations. Check that the backend is running.')
        }
      } finally {
        if (active) {
          setLoading(false)
        }
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
    await createLostItem({
      title: title.trim(),
      description: description.trim(),
      category_id: categoryId,
      location_id: locationId,
      date_lost: dateLost,
    })

    setSuccess('Your lost report was saved successfully.')
    setTitle('')
    setDescription('')
    setDateLost('')
    setCategoryId('')
    setLocationId('')
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
      <h2>Report a lost item</h2>

      {loading && <p role="status">Loading options...</p>}
      {error && <p role="alert">{error}</p>}

      {!loading && !error && (
       <form
                        onSubmit={handleSubmit}
                        style={{ display: 'grid', gap: '16px', maxWidth: '480px' }}
                        >



            <label htmlFor="lost-title">
                            Item title
                            <input
                                id="lost-title"
                                type="text"
                                value={title}
                                onChange={(event) => setTitle(event.target.value)}
                                placeholder="Example: Black Samsung phone"
                                required
                                maxLength={150}
                                style={{ display: 'block', width: '100%', padding: '10px' }}
                            />
                            </label>

                            <label htmlFor="lost-description">
                            Description
                            <textarea
                                id="lost-description"
                                value={description}
                                onChange={(event) => setDescription(event.target.value)}
                                placeholder="Describe the item and where you last saw it"
                                required
                                maxLength={2000}
                                rows={4}
                                style={{ display: 'block', width: '100%', padding: '10px' }}
                            />
                            </label>

                            <label htmlFor="lost-date">
                            Date lost
                            <input
                                id="lost-date"
                                type="date"
                                value={dateLost}
                                onChange={(event) => setDateLost(event.target.value)}
                                required
                                style={{ display: 'block', width: '100%', padding: '10px' }}
                            />
                            </label>



          <label htmlFor="lost-category">
            Category
            <select
            required
              id="lost-category"
              value={categoryId}
              onChange={(event) => setCategoryId(event.target.value)}
              style={{ display: 'block', width: '100%', padding: '10px' }}
            >
              <option value="">Select a category</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>

          <label htmlFor="lost-location">
            Last seen location
            <select
              required
              id="lost-location"
              value={locationId}
              onChange={(event) => setLocationId(event.target.value)}
              style={{ display: 'block', width: '100%', padding: '10px' }}
            >
              <option value="">Select a location</option>
              {locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.name}
                </option>
              ))}
            </select>
          </label>
         <button
                    type="submit"
                    disabled={saving}
                    style={{ padding: '12px', cursor: 'pointer' }}
                >
                    {saving ? 'Saving...' : 'Save report'}
                </button>

                {saveError && <p role="alert">{saveError}</p>}
                {success && <p role="status">{success}</p>}
</form>


      )}
    </section>
  )
}