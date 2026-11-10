import { useState } from 'react'
import { Check, Copy, KeyRound, ShieldAlert } from 'lucide-react'
import { Modal } from '../ui'

/**
 * Shows a claim credential exactly once (after a lost report is created or
 * a credential is recovered). The server keeps only its hash.
 */
export function ClaimCredentialModal({
  code,
  onDone,
  title = 'Your claim credential',
}: {
  code: string
  onDone: () => void
  title?: string
}) {
  const [copied, setCopied] = useState(false)
  const [acknowledged, setAcknowledged] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  return (
    <Modal
      title={title}
      onClose={onDone}
      dismissible={false}
      footer={
        <button type="button" className="btn btn-primary btn-block" disabled={!acknowledged} onClick={onDone}>
          I’ve saved my code — continue
        </button>
      }
    >
      <div className="credential-box">
        <KeyRound size={20} />
        <code className="credential-code" aria-label="Claim credential">
          {code}
        </code>
        <button type="button" className="btn btn-secondary btn-sm" onClick={copy}>
          {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <div className="alert alert-warning">
        <ShieldAlert size={18} />
        <span>
          You’ll need this code to collect your item. <strong>It won’t be shown again</strong> — store it
          somewhere safe. If you lose it, you can recover a new one from your claims page by answering your
          private ownership question.
        </span>
      </div>
      <label className="checkbox-row">
        <input type="checkbox" checked={acknowledged} onChange={(e) => setAcknowledged(e.target.checked)} />
        <span>I have copied or written down my claim credential</span>
      </label>
    </Modal>
  )
}
