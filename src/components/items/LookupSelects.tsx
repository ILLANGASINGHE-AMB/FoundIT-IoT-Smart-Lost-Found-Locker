import { forwardRef, type ReactNode, type SelectHTMLAttributes } from 'react'
import { useCategories, useCollectionPoints, useLocations } from '../../hooks/useLookups'

type SelectProps = SelectHTMLAttributes<HTMLSelectElement>

/**
 * The registered <select> only mounts once its options exist, so a
 * pre-filled value (e.g. from a QR scan) is applied when the form field
 * attaches instead of being lost against an empty option list.
 */
function LookupSelect({
  loading,
  selectRef,
  props,
  placeholder,
  children,
}: {
  loading: boolean
  selectRef: React.ForwardedRef<HTMLSelectElement>
  props: SelectProps
  placeholder: string
  children: ReactNode
}) {
  if (loading) {
    return (
      <select className="select" disabled aria-busy="true" id={props.id}>
        <option>Loading…</option>
      </select>
    )
  }
  return (
    <select ref={selectRef} {...props} className="select">
      <option value="">{placeholder}</option>
      {children}
    </select>
  )
}

/** Dropdown populated from the `categories` table. */
export const CategorySelect = forwardRef<HTMLSelectElement, SelectProps>(function CategorySelect(props, ref) {
  const { data, isLoading } = useCategories()
  return (
    <LookupSelect loading={isLoading} selectRef={ref} props={props} placeholder="Select a category">
      {data?.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name}
        </option>
      ))}
    </LookupSelect>
  )
})

/** Dropdown populated from the controlled `locations` list (spec §11). */
export const LocationSelect = forwardRef<HTMLSelectElement, SelectProps>(function LocationSelect(props, ref) {
  const { data, isLoading } = useLocations()
  return (
    <LookupSelect loading={isLoading} selectRef={ref} props={props} placeholder="Select a location">
      {data?.map((l) => (
        <option key={l.id} value={l.id}>
          {l.name}
          {l.building && l.building !== l.name ? ` — ${l.building}` : ''}
        </option>
      ))}
    </LookupSelect>
  )
})

export const CollectionPointSelect = forwardRef<HTMLSelectElement, SelectProps>(function CollectionPointSelect(
  props,
  ref,
) {
  const { data, isLoading } = useCollectionPoints()
  return (
    <LookupSelect
      loading={isLoading}
      selectRef={ref}
      props={props}
      placeholder="I still have the item / not handed in yet"
    >
      {data?.map((p) => (
        <option key={p.id} value={p.id}>
          {p.name}
        </option>
      ))}
    </LookupSelect>
  )
})
