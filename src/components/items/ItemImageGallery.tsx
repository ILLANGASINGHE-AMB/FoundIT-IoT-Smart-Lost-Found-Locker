import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, ImageOff, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { deleteItemImage, getItemImages, type ItemKind } from '../../services/items'
import { Skeleton } from '../ui'

/** Image gallery for an item (signed URLs from the private bucket). */
export function ItemImageGallery({
  kind,
  itemId,
  canDelete = false,
}: {
  kind: ItemKind
  itemId: string
  canDelete?: boolean
}) {
  const queryClient = useQueryClient()
  const [index, setIndex] = useState(0)
  const { data: images, isLoading } = useQuery({
    queryKey: ['item-images', kind, itemId],
    queryFn: () => getItemImages(kind, itemId),
    staleTime: 30 * 60 * 1000,
  })

  const remove = useMutation({
    mutationFn: deleteItemImage,
    onSuccess: () => {
      toast.success('Photo removed.')
      setIndex(0)
      queryClient.invalidateQueries({ queryKey: ['item-images', kind, itemId] })
    },
  })

  if (isLoading) return <Skeleton height={280} radius={16} />

  if (!images || images.length === 0) {
    return (
      <div className="gallery-empty">
        <ImageOff size={26} />
        <span>No photos</span>
      </div>
    )
  }

  const current = images[Math.min(index, images.length - 1)]

  return (
    <div className="gallery">
      <div className="gallery-main">
        <img src={current.url} alt={`Photo ${index + 1} of ${images.length}`} />
        {images.length > 1 && (
          <>
            <button
              type="button"
              className="gallery-nav prev"
              onClick={() => setIndex((i) => (i - 1 + images.length) % images.length)}
              aria-label="Previous photo"
            >
              <ChevronLeft size={20} />
            </button>
            <button
              type="button"
              className="gallery-nav next"
              onClick={() => setIndex((i) => (i + 1) % images.length)}
              aria-label="Next photo"
            >
              <ChevronRight size={20} />
            </button>
          </>
        )}
        {canDelete && (
          <button
            type="button"
            className="gallery-delete"
            disabled={remove.isPending}
            onClick={() => window.confirm('Remove this photo?') && remove.mutate(current)}
            aria-label="Remove this photo"
          >
            <Trash2 size={16} />
          </button>
        )}
      </div>
      {images.length > 1 && (
        <div className="gallery-thumbs">
          {images.map((img, i) => (
            <button
              key={img.id}
              type="button"
              className={i === index ? 'active' : ''}
              onClick={() => setIndex(i)}
              aria-label={`Show photo ${i + 1}`}
            >
              <img src={img.url} alt="" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
