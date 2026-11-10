import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ArrowLeft, ArrowRight, CheckCircle2, Lock, RotateCcw, Send } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { createLostItem } from '../../services/lostItems'
import { createFoundItem } from '../../services/foundItems'
import { uploadItemImage } from '../../services/items'
import { friendlyError } from '../../lib/errors'
import { todayIso } from '../../lib/format'
import { IDENTIFIER_TYPES } from '../../types'
import { FieldError } from '../ui'
import { CategorySelect, CollectionPointSelect, LocationSelect } from './LookupSelects'
import { PhotoPicker, type PickedPhoto } from './PhotoPicker'
import { ClaimCredentialModal } from './ClaimCredentialModal'
import {
  COLOR_SUGGESTIONS,
  IDENTIFIER_LABELS,
  blankToNull,
  itemFormSchema,
  type ItemFormValues,
} from './itemSchemas'

type Kind = 'lost' | 'found'

const STEPS = [
  { title: 'Basic info', fields: ['title', 'category_id', 'date', 'location_id', 'collection_point_id'] },
  { title: 'Details', fields: ['brand', 'model', 'color', 'description', 'identifier_type', 'identifier_value'] },
  { title: 'Photos & privacy', fields: ['private_ownership_info'] },
] as const

/**
 * Report Lost / Found item form (spec §41) as a 3-step wizard:
 *   1. basic info → 2. details → 3. photos (+ private info for lost items)
 * After saving, photos upload one by one (with retry) and lost reports
 * show the one-time claim credential.
 */
export function ReportForm({
  kind,
  prefill,
}: {
  kind: Kind
  prefill?: { location_id?: string; collection_point_id?: string; collectionPointName?: string }
}) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const [step, setStep] = useState(0)
  const [photos, setPhotos] = useState<PickedPhoto[]>([])
  const [saved, setSaved] = useState<{ id: string; claimCode?: string } | null>(null)
  const [showCredential, setShowCredential] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [submitError, setSubmitError] = useState('')

  const {
    register,
    handleSubmit,
    trigger,
    formState: { errors, isSubmitting },
  } = useForm<ItemFormValues>({
    resolver: zodResolver(itemFormSchema),
    defaultValues: {
      kind,
      title: '',
      category_id: '',
      location_id: prefill?.location_id ?? '',
      date: todayIso(),
      collection_point_id: prefill?.collection_point_id ?? '',
      brand: '',
      model: '',
      color: '',
      description: '',
      identifier_type: '',
      identifier_value: '',
      private_ownership_info: '',
    },
  })

  const detailPath = (id: string) => `/${kind}/${id}`

  const uploadPhotos = async (itemId: string, list: PickedPhoto[]) => {
    if (!user) return list
    setUploading(true)
    const results = [...list]
    for (let i = 0; i < results.length; i++) {
      if (results[i].status === 'uploaded') continue
      results[i] = { ...results[i], status: 'uploading', error: undefined }
      setPhotos([...results])
      try {
        await uploadItemImage(kind, itemId, results[i].file, user.id)
        results[i] = { ...results[i], status: 'uploaded' }
      } catch (err) {
        results[i] = { ...results[i], status: 'failed', error: friendlyError(err) }
      }
      setPhotos([...results])
    }
    setUploading(false)
    queryClient.invalidateQueries({ queryKey: ['item-images', kind, itemId] })
    return results
  }

  const finish = (itemId: string, list: PickedPhoto[]) => {
    if (list.some((p) => p.status === 'failed')) return // stay: let the user retry
    toast.success(kind === 'lost' ? 'Lost report saved. We’ll notify you about matches.' : 'Thanks! Your found report is saved.')
    navigate(detailPath(itemId), { replace: true })
  }

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError('')
    try {
      const common = {
        title: values.title,
        description: values.description,
        category_id: values.category_id,
        location_id: values.location_id,
        brand: blankToNull(values.brand),
        model: blankToNull(values.model),
        color: blankToNull(values.color),
        identifier_type: values.identifier_value ? values.identifier_type || null : null,
        identifier_value: blankToNull(values.identifier_value),
      }
      const result =
        kind === 'lost'
          ? await createLostItem({
              ...common,
              date_lost: values.date,
              private_ownership_info: blankToNull(values.private_ownership_info),
            })
          : await createFoundItem({
              ...common,
              date_found: values.date,
              collection_point_id: values.collection_point_id || null,
            })

      const claimCode = 'claim_code' in result ? result.claim_code : undefined
      setSaved({ id: result.id, claimCode })
      queryClient.invalidateQueries({ queryKey: [kind === 'lost' ? 'lost-items' : 'found-items'] })
      if (claimCode) setShowCredential(true)

      const uploaded = await uploadPhotos(result.id, photos)
      if (!claimCode) finish(result.id, uploaded)
    } catch (err) {
      setSubmitError(friendlyError(err))
    }
  })

  const next = async () => {
    const ok = await trigger([...STEPS[step].fields] as (keyof ItemFormValues)[])
    if (ok) setStep((s) => Math.min(s + 1, STEPS.length - 1))
  }

  const failedCount = photos.filter((p) => p.status === 'failed').length
  const busy = isSubmitting || uploading

  // ── After save: upload progress / retry ──
  if (saved) {
    return (
      <div className="card stack">
        <div className="row">
          <CheckCircle2 size={22} color="var(--color-success)" />
          <h2 className="card-title" style={{ margin: 0 }}>
            Report saved
          </h2>
        </div>
        {photos.length > 0 && (
          <PhotoPicker photos={photos} onChange={setPhotos} disabled />
        )}
        {uploading && <p className="muted" role="status">Uploading photos…</p>}
        {failedCount > 0 && !uploading && (
          <div className="alert alert-warning" role="alert">
            <span>
              Your report is saved, but {failedCount} photo(s) could not be uploaded. Retry them, or continue
              and add photos later.
            </span>
          </div>
        )}
        <div className="row">
          {failedCount > 0 && (
            <button
              type="button"
              className="btn btn-secondary"
              disabled={uploading}
              onClick={() => uploadPhotos(saved.id, photos).then((list) => !showCredential && finish(saved.id, list))}
            >
              <RotateCcw size={16} /> Retry failed photos
            </button>
          )}
          <button
            type="button"
            className="btn btn-primary"
            disabled={uploading || showCredential}
            onClick={() => navigate(detailPath(saved.id), { replace: true })}
          >
            View report <ArrowRight size={16} />
          </button>
        </div>

        {showCredential && saved.claimCode && (
          <ClaimCredentialModal
            code={saved.claimCode}
            onDone={() => {
              setShowCredential(false)
              if (!uploading) finish(saved.id, photos)
            }}
          />
        )}
      </div>
    )
  }

  return (
    <form className="card form report-wizard" onSubmit={onSubmit} noValidate>
      <ol className="wizard-steps" aria-label="Progress">
        {STEPS.map((s, i) => (
          <li key={s.title} className={i === step ? 'current' : i < step ? 'done' : ''}>
            <span className="wizard-step-dot">{i + 1}</span>
            <span className="wizard-step-label">{s.title}</span>
          </li>
        ))}
      </ol>

      {prefill?.collectionPointName && kind === 'found' && (
        <div className="alert alert-info">
          <span>
            You’re handing this item in at <strong>{prefill.collectionPointName}</strong>.
          </span>
        </div>
      )}

      {/* Step 1 — basic info */}
      <fieldset className="form" hidden={step !== 0} disabled={busy}>
        <div className="field">
          <label htmlFor="title">What is it?</label>
          <input
            id="title"
            className="input"
            placeholder={kind === 'lost' ? 'e.g. Black Casio calculator' : 'e.g. Blue water bottle'}
            aria-invalid={Boolean(errors.title)}
            {...register('title')}
          />
          <FieldError message={errors.title?.message} />
        </div>
        <div className="form-row">
          <div className="field">
            <label htmlFor="category_id">Category</label>
            <CategorySelect id="category_id" aria-invalid={Boolean(errors.category_id)} {...register('category_id')} />
            <FieldError message={errors.category_id?.message} />
          </div>
          <div className="field">
            <label htmlFor="date">{kind === 'lost' ? 'Date lost' : 'Date found'}</label>
            <input id="date" type="date" className="input" max={todayIso()} aria-invalid={Boolean(errors.date)} {...register('date')} />
            <FieldError message={errors.date?.message} />
          </div>
        </div>
        <div className="field">
          <label htmlFor="location_id">{kind === 'lost' ? 'Where did you lose it?' : 'Where did you find it?'}</label>
          <LocationSelect id="location_id" aria-invalid={Boolean(errors.location_id)} {...register('location_id')} />
          <FieldError message={errors.location_id?.message} />
        </div>
        {kind === 'found' && (
          <div className="field">
            <label htmlFor="collection_point_id">Handed in at a FoundIT Box?</label>
            <CollectionPointSelect id="collection_point_id" {...register('collection_point_id')} />
            <span className="field-hint">If you dropped it at a collection point, choose it so the owner knows where to collect.</span>
          </div>
        )}
      </fieldset>

      {/* Step 2 — details */}
      <fieldset className="form" hidden={step !== 1} disabled={busy}>
        <div className="form-row">
          <div className="field">
            <label htmlFor="brand">Brand</label>
            <input id="brand" className="input" placeholder="e.g. Casio" {...register('brand')} />
          </div>
          <div className="field">
            <label htmlFor="model">Model</label>
            <input id="model" className="input" placeholder="e.g. fx-991ES PLUS" {...register('model')} />
          </div>
        </div>
        <div className="field">
          <label htmlFor="color">Colour</label>
          <input id="color" className="input" list="color-suggestions" placeholder="e.g. Black" {...register('color')} />
          <datalist id="color-suggestions">
            {COLOR_SUGGESTIONS.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </div>
        <div className="field">
          <label htmlFor="description">Description</label>
          <textarea
            id="description"
            className="textarea"
            rows={4}
            placeholder={
              kind === 'lost'
                ? 'Describe it so others can recognise it — size, stickers, case, contents…'
                : 'Describe what you found. Leave out anything only the owner would know.'
            }
            aria-invalid={Boolean(errors.description)}
            {...register('description')}
          />
          <FieldError message={errors.description?.message} />
        </div>
        <div className="form-row">
          <div className="field">
            <label htmlFor="identifier_type">Unique identifier (optional)</label>
            <select id="identifier_type" className="select" aria-invalid={Boolean(errors.identifier_type)} {...register('identifier_type')}>
              <option value="">None</option>
              {IDENTIFIER_TYPES.map((t) => (
                <option key={t} value={t}>
                  {IDENTIFIER_LABELS[t]}
                </option>
              ))}
            </select>
            <FieldError message={errors.identifier_type?.message} />
          </div>
          <div className="field">
            <label htmlFor="identifier_value">Identifier value</label>
            <input id="identifier_value" className="input" autoComplete="off" {...register('identifier_value')} />
            <span className="field-hint">
              <Lock size={11} /> Encrypted with a keyed hash on the server — never stored or shown.
            </span>
          </div>
        </div>
      </fieldset>

      {/* Step 3 — photos & private info */}
      <fieldset className="form" hidden={step !== 2} disabled={busy}>
        <div className="field">
          <span className="field-label">Photos (optional)</span>
          <PhotoPicker photos={photos} onChange={setPhotos} disabled={busy} />
        </div>
        {kind === 'lost' && (
          <div className="field private-field">
            <label htmlFor="private_ownership_info">
              <Lock size={14} /> Private ownership information
            </label>
            <textarea
              id="private_ownership_info"
              className="textarea"
              rows={3}
              placeholder="Something only the owner would know, e.g. “small scratch beside the AC button”."
              {...register('private_ownership_info')}
            />
            <span className="field-hint">
              Never shown to other users. Used to verify you’re the owner when you claim the item.
            </span>
            <FieldError message={errors.private_ownership_info?.message} />
          </div>
        )}
      </fieldset>

      {submitError && (
        <div className="alert alert-error" role="alert">
          <span>{submitError}</span>
        </div>
      )}

      <div className="row-between wizard-actions">
        {step > 0 ? (
          <button type="button" className="btn btn-ghost" onClick={() => setStep((s) => s - 1)} disabled={busy}>
            <ArrowLeft size={16} /> Back
          </button>
        ) : (
          <span />
        )}
        {step < STEPS.length - 1 ? (
          <button type="button" className="btn btn-dark" onClick={next}>
            Next <ArrowRight size={16} />
          </button>
        ) : (
          <button type="submit" className="btn btn-primary" disabled={busy}>
            <Send size={16} /> {isSubmitting ? 'Submitting…' : `Submit ${kind} report`}
          </button>
        )}
      </div>
    </form>
  )
}
