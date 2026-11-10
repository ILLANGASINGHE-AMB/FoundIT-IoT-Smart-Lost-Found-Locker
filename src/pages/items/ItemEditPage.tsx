import { useNavigate, useParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Lock, Save } from 'lucide-react'
import { getLostItemById, getLostItemPrivateInfo, updateLostItem } from '../../services/lostItems'
import { getFoundItemById, updateFoundItem } from '../../services/foundItems'
import { onItemUpdated } from '../../services/itemEvents'
import { friendlyError } from '../../lib/errors'
import { todayIso } from '../../lib/format'
import { ErrorState, FieldError, PageHeader, SkeletonList } from '../../components/ui'
import { CategorySelect, LocationSelect } from '../../components/items/LookupSelects'
import { COLOR_SUGGESTIONS, blankToNull, itemFormSchema, type ItemFormValues } from '../../components/items/itemSchemas'

type Kind = 'lost' | 'found'

async function loadForEdit(kind: Kind, id: string): Promise<ItemFormValues> {
  if (kind === 'lost') {
    const [item, privateInfo] = await Promise.all([getLostItemById(id), getLostItemPrivateInfo(id)])
    if (!['LOST', 'MATCHED'].includes(item.status)) throw new Error('This report can no longer be edited.')
    return {
      kind,
      title: item.title,
      category_id: item.category_id,
      location_id: item.location_id,
      date: item.date_lost,
      collection_point_id: '',
      brand: item.brand ?? '',
      model: item.model ?? '',
      color: item.color ?? '',
      description: item.description,
      identifier_type: '',
      identifier_value: '',
      private_ownership_info: privateInfo ?? '',
    }
  }
  const item = await getFoundItemById(id)
  if (!['FOUND', 'IN_STORAGE', 'MATCHED'].includes(item.status)) throw new Error('This report can no longer be edited.')
  return {
    kind,
    title: item.title,
    category_id: item.category_id,
    location_id: item.location_id,
    date: item.date_found,
    collection_point_id: item.collection_point_id ?? '',
    brand: item.brand ?? '',
    model: item.model ?? '',
    color: item.color ?? '',
    description: item.description,
    identifier_type: '',
    identifier_value: '',
    private_ownership_info: '',
  }
}

/** /lost/:id/edit and /found/:id/edit — owner edits an active report. */
export function ItemEditPage({ kind }: { kind: Kind }) {
  const { id = '' } = useParams()
  const query = useQuery({ queryKey: ['item-edit', kind, id], queryFn: () => loadForEdit(kind, id), gcTime: 0 })

  return (
    <div className="page page-narrow">
      <PageHeader backTo={`/${kind}/${id}`} backLabel="Back to report" title="Edit report" />
      {query.isLoading && <SkeletonList rows={5} height={56} />}
      {query.isError && <ErrorState message={query.error.message} />}
      {query.data && <EditForm kind={kind} id={id} defaults={query.data} />}
    </div>
  )
}

function EditForm({ kind, id, defaults }: { kind: Kind; id: string; defaults: ItemFormValues }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<ItemFormValues>({ resolver: zodResolver(itemFormSchema), defaultValues: defaults })

  const onSubmit = handleSubmit(async (values) => {
    const fields = {
      title: values.title,
      description: values.description,
      category_id: values.category_id,
      location_id: values.location_id,
      brand: blankToNull(values.brand),
      model: blankToNull(values.model),
      color: blankToNull(values.color),
    }
    try {
      if (kind === 'lost') {
        await updateLostItem(id, {
          ...fields,
          date_lost: values.date,
          private_ownership_info: values.private_ownership_info,
        })
      } else {
        await updateFoundItem(id, { ...fields, date_found: values.date })
      }
      await onItemUpdated(kind, id)
      queryClient.invalidateQueries({ queryKey: [`${kind}-item`, id] })
      queryClient.invalidateQueries({ queryKey: [`${kind}-items`] })
      toast.success('Report updated.')
      navigate(`/${kind}/${id}`)
    } catch (err) {
      setError('root', { message: friendlyError(err) })
    }
  })

  return (
    <form className="card form" onSubmit={onSubmit} noValidate>
      <div className="field">
        <label htmlFor="title">Title</label>
        <input id="title" className="input" aria-invalid={Boolean(errors.title)} {...register('title')} />
        <FieldError message={errors.title?.message} />
      </div>
      <div className="form-row">
        <div className="field">
          <label htmlFor="category_id">Category</label>
          <CategorySelect id="category_id" {...register('category_id')} />
          <FieldError message={errors.category_id?.message} />
        </div>
        <div className="field">
          <label htmlFor="date">{kind === 'lost' ? 'Date lost' : 'Date found'}</label>
          <input id="date" type="date" className="input" max={todayIso()} {...register('date')} />
          <FieldError message={errors.date?.message} />
        </div>
      </div>
      <div className="field">
        <label htmlFor="location_id">Location</label>
        <LocationSelect id="location_id" {...register('location_id')} />
        <FieldError message={errors.location_id?.message} />
      </div>
      <div className="form-row">
        <div className="field">
          <label htmlFor="brand">Brand</label>
          <input id="brand" className="input" {...register('brand')} />
        </div>
        <div className="field">
          <label htmlFor="model">Model</label>
          <input id="model" className="input" {...register('model')} />
        </div>
      </div>
      <div className="field">
        <label htmlFor="color">Colour</label>
        <input id="color" className="input" list="color-suggestions" {...register('color')} />
        <datalist id="color-suggestions">
          {COLOR_SUGGESTIONS.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
      </div>
      <div className="field">
        <label htmlFor="description">Description</label>
        <textarea id="description" className="textarea" rows={4} {...register('description')} />
        <FieldError message={errors.description?.message} />
      </div>
      {kind === 'lost' && (
        <div className="field private-field">
          <label htmlFor="private_ownership_info">
            <Lock size={14} /> Private ownership information
          </label>
          <textarea id="private_ownership_info" className="textarea" rows={3} {...register('private_ownership_info')} />
          <span className="field-hint">Never shown to other users.</span>
        </div>
      )}
      {errors.root && (
        <div className="alert alert-error" role="alert">
          <span>{errors.root.message}</span>
        </div>
      )}
      <div className="row">
        <button type="submit" className="btn btn-primary" disabled={isSubmitting || !isDirty}>
          <Save size={16} /> {isSubmitting ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </form>
  )
}
