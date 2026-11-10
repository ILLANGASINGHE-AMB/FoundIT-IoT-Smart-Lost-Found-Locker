import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { ShieldQuestion } from 'lucide-react'
import { recoverCredential } from '../../services/claims'
import { friendlyError } from '../../lib/errors'
import { Modal } from '../ui'
import { ClaimCredentialModal } from '../items/ClaimCredentialModal'

/**
 * Recover a lost claim credential (spec §24): re-verify with the private
 * ownership detail; the server issues a new code and invalidates the old.
 */
export function CredentialRecoveryModal({
  lostItemId,
  itemTitle,
  onClose,
}: {
  lostItemId: string
  itemTitle: string
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const [answer, setAnswer] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [newCode, setNewCode] = useState<string | null>(null)

  if (newCode) {
    return <ClaimCredentialModal code={newCode} title="Your new claim credential" onDone={onClose} />
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!answer.trim()) return setError('Enter the private detail you recorded.')
    setBusy(true)
    setError('')
    try {
      const { claim_code } = await recoverCredential(lostItemId, answer.trim())
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
      setNewCode(claim_code)
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title="Recover claim credential" onClose={onClose}>
      <form className="form" onSubmit={submit} noValidate>
        <p className="muted">
          Lost the code for <strong>{itemTitle}</strong>? Answer your private ownership question and we’ll issue a new
          one. Your old code will stop working.
        </p>
        <div className="field">
          <label htmlFor="recovery-answer">
            <ShieldQuestion size={14} /> Private ownership detail
          </label>
          <textarea
            id="recovery-answer"
            className="textarea"
            rows={3}
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            disabled={busy}
          />
        </div>
        {error && <span className="field-error" role="alert">{error}</span>}
        <div className="modal-footer">
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? 'Verifying…' : 'Issue new credential'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
