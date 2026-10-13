import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { updateLostItem } from '../../services/lostItems'
import type { LostItemDetails } from '../../services/lostItems'
import { getCategories, getLocations } from '../../services/itemLookups'
import type { LookupOption } from '../../services/itemLookups'

type Props = {
  report: LostItemDetails
  onSaved: () => void
  onCancel: () => void
}

const fieldStyle = {
  display: 'block',
  width: '100%',
  padding: '10px',
  boxSizing: 'border-box' as const,
}

export function EditLostItemForm({ report, onSaved, onCancel }: Props) {
  const [values, setValues] = useState({
    title: report.title,
    description: report.description,
    category_id: report.category_id,
    location_id: report.location_id,
    date_lost: report.date_lost,
  })

  const [categories, setCategories] = useState<LookupOption[]>([])
  const [locations, setLocations] = useState<LookupOption[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [saveError, setSaveError] = useState('')
  const [saving, setSaving] = useState(false)

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
        if (active) setLoadError('Could not load categories and locations.')
      } finally {
        if (active) setLoading(false)
      }
    }

    void loadOptions()

    return () => {
      active = false
    }
  }, [])

  function changeField(field: keyof typeof values, value: string) {
    setValues((current) => ({ ...current, [field]: value }))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (saving) return

    setSaveError('')

    if (!values.title.trim() || !values.description.trim()) {
      setSaveError('Enter a title and description, not just spaces.')
      return
    }

    setSaving(true)

    try {
      await updateLostItem(report.id, {
        ...values,
        title: values.title.trim(),
        description: values.description.trim(),
      })
    } catch (error) {
      setSaveError(
        error instanceof Error ? error.message : 'Could not save changes'
      )
      setSaving(false)
      return
    }

    setSaving(false)
    onSaved()
  }

  return (
    <section style={{ maxWidth: '480px' }}>
      <h2>Edit lost report</h2>

      {loading && <p role="status">Loading options...</p>}
      {loadError && <p role="alert">{loadError}</p>}

      {!loading && !loadError && (
        <form onSubmit={handleSubmit}>
          <fieldset
            disabled={saving}
            style={{
              display: 'grid',
              gap: '16px',
              border: 0,
              padding: 0,
              margin: '16px 0',
              minWidth: 0,
            }}
          >
            <label>
              Title
              <input
                value={values.title}
                onChange={(event) => changeField('title', event.target.value)}
                required
                maxLength={150}
                style={fieldStyle}
              />
            </label>

            <label>
              Description
              <textarea
                value={values.description}
                onChange={(event) =>
                  changeField('description', event.target.value)
                }
                required
                maxLength={2000}
                rows={4}
                style={fieldStyle}
              />
            </label>

            <label>
              Date lost
              <input
                type="date"
                value={values.date_lost}
                onChange={(event) =>
                  changeField('date_lost', event.target.value)
                }
                required
                style={fieldStyle}
              />
            </label>

            <label>
              Category
              <select
                value={values.category_id}
                onChange={(event) =>
                  changeField('category_id', event.target.value)
                }
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

            <label>
              Last seen location
              <select
                value={values.location_id}
                onChange={(event) =>
                  changeField('location_id', event.target.value)
                }
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
              {saving ? 'Saving...' : 'Save changes'}
            </button>
          </fieldset>

          {saveError && <p role="alert">{saveError}</p>}
        </form>
      )}

      <button
        type="button"
        onClick={onCancel}
        disabled={saving}
        style={{ padding: '10px 16px' }}
      >
        Back without saving
      </button>
    </section>
  )
}