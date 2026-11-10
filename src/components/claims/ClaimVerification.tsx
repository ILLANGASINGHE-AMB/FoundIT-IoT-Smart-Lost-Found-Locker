import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { CheckCircle2, KeyRound, Lock, ShieldCheck } from 'lucide-react'
import {
  MAX_ATTEMPTS,
  failedAttemptsInWindow,
  verifyClaim,
  verifyClaimCode,
  type ClaimDetail,
} from '../../services/claims'
import { friendlyError } from '../../lib/errors'
import { AttemptCounter } from './AttemptCounter'

type Step = 'PRIVATE_ATTRIBUTE' | 'CLAIM_CODE' | 'REVIEW' | 'LOCKED'

function initialStep(claim: ClaimDetail): Step {
  if (claim.is_locked) return 'LOCKED'
  if (claim.status !== 'PENDING') return 'REVIEW'
  const passed = (type: string) =>
    claim.claim_verifications.some((v) => v.verification_type === type && v.result === 'PASSED')
  if (passed('CLAIM_CODE')) return 'REVIEW'
  if (passed('PRIVATE_ATTRIBUTE')) return 'CLAIM_CODE'
  return 'PRIVATE_ATTRIBUTE'
}

/** Normalises typed credentials to FND-XXXX-XXXX-XXXX as the user types. */
function formatCode(raw: string): string {
  const chars = raw.toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/^FND/, '').slice(0, 12)
  const groups = chars.match(/.{1,4}/g) ?? []
  return chars.length ? `FND-${groups.join('-')}` : ''
}

/**
 * Two-step ownership verification (spec §23–24), one step per screen:
 *   1. private ownership detail  →  2. claim credential
 * Attempts are counted server-side; 5 failures lock the claim.
 */
export function ClaimVerification({ claim }: { claim: ClaimDetail }) {
  const queryClient = useQueryClient()
  const [step, setStep] = useState<Step>(() => initialStep(claim))
  const [remaining, setRemaining] = useState(() => MAX_ATTEMPTS - failedAttemptsInWindow(claim.claim_attempts))
  const [answer, setAnswer] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['claim', claim.id] })
    queryClient.invalidateQueries({ queryKey: ['claims'] })
  }

  const submitAnswer = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!answer.trim()) return setError('Enter the private detail you recorded.')
    setBusy(true)
    setError('')
    try {
      const out = await verifyClaim(claim.id, answer.trim())
      setRemaining(out.remaining_attempts)
      if (out.locked) setStep('LOCKED')
      else if (out.result === 'PASSED') {
        toast.success('Ownership detail confirmed.')
        setStep('CLAIM_CODE')
      } else setError('That doesn’t match the details you recorded. Check the wording and try again.')
      if (out.locked || out.result === 'PASSED') refresh()
    } catch (err) {
      const message = friendlyError(err)
      if (/locked/i.test(message)) setStep('LOCKED')
      setError(message)
    } finally {
      setBusy(false)
    }
  }

  const submitCode = async (e: React.FormEvent) => {
    e.preventDefault()
    if (code.replace(/[^A-Z0-9]/g, '').length < 15) return setError('Enter the full code, e.g. FND-7K4P-92XQ-M3TA.')
    setBusy(true)
    setError('')
    try {
      const out = await verifyClaimCode(claim.id, code)
      setRemaining(out.remaining_attempts)
      if (out.locked) setStep('LOCKED')
      else if (out.result === 'PASSED') {
        toast.success('Claim verified! An administrator will review it shortly.')
        setStep('REVIEW')
      } else setError('That claim credential is not correct.')
      refresh()
    } catch (err) {
      const message = friendlyError(err)
      if (/locked/i.test(message)) setStep('LOCKED')
      setError(message)
    } finally {
      setBusy(false)
    }
  }

  if (step === 'LOCKED') {
    return (
      <div className="alert alert-error" role="alert">
        <Lock size={18} />
        <span>
          <strong>This claim is locked for review.</strong> Too many verification attempts failed. An administrator
          will contact you.
        </span>
      </div>
    )
  }

  if (step === 'REVIEW') {
    return (
      <div className="alert alert-success">
        <CheckCircle2 size={18} />
        <span>
          <strong>Verification complete.</strong> An administrator is reviewing your claim. We’ll notify you when your
          item is ready to collect.
        </span>
      </div>
    )
  }

  return (
    <div className="stack">
      <ol className="wizard-steps" aria-label="Verification progress">
        <li className={step === 'PRIVATE_ATTRIBUTE' ? 'current' : 'done'}>
          <span className="wizard-step-dot">1</span>
          <span className="wizard-step-label">Private detail</span>
        </li>
        <li className={step === 'CLAIM_CODE' ? 'current' : ''}>
          <span className="wizard-step-dot">2</span>
          <span className="wizard-step-label">Claim credential</span>
        </li>
      </ol>

      <AttemptCounter remaining={remaining} />

      {step === 'PRIVATE_ATTRIBUTE' && (
        <form className="form" onSubmit={submitAnswer} noValidate>
          <div className="field">
            <label htmlFor="private-answer">
              <ShieldCheck size={14} /> What private detail did you record about this item?
            </label>
            <textarea
              id="private-answer"
              className="textarea"
              rows={3}
              placeholder="e.g. small scratch beside the AC button"
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              disabled={busy}
            />
            <span className="field-hint">
              This is the “private ownership information” you gave when reporting the item. It’s compared securely on the
              server — nobody else sees it.
            </span>
          </div>
          {error && <span className="field-error" role="alert">{error}</span>}
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? 'Checking…' : 'Continue'}
          </button>
        </form>
      )}

      {step === 'CLAIM_CODE' && (
        <form className="form" onSubmit={submitCode} noValidate>
          <div className="field">
            <label htmlFor="claim-code">
              <KeyRound size={14} /> Claim credential
            </label>
            <input
              id="claim-code"
              className="input mono credential-input"
              placeholder="FND-XXXX-XXXX-XXXX"
              autoComplete="off"
              spellCheck={false}
              inputMode="text"
              value={code}
              onChange={(e) => setCode(formatCode(e.target.value))}
              disabled={busy}
            />
            <span className="field-hint">
              The code shown once when you reported this item. Lost it?{' '}
              <Link to={`/lost/${claim.lost_item_id}?recover=1`}>Recover a new credential</Link>.
            </span>
          </div>
          {error && <span className="field-error" role="alert">{error}</span>}
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? 'Verifying…' : 'Verify and submit claim'}
          </button>
        </form>
      )}
    </div>
  )
}
