import { forwardRef, useState, type InputHTMLAttributes } from 'react'
import { Eye, EyeOff, Lock } from 'lucide-react'
import { passwordStrength } from './schemas'

type Props = InputHTMLAttributes<HTMLInputElement> & { showStrength?: boolean; value?: string }

export const PasswordInput = forwardRef<HTMLInputElement, Props>(function PasswordInput(
  { showStrength, value, ...props },
  ref,
) {
  const [visible, setVisible] = useState(false)
  const strength = showStrength ? passwordStrength(value ?? '') : 0

  return (
    <>
      <div className="input-group">
        <Lock className="input-field-icon" size={18} />
        <input
          ref={ref}
          type={visible ? 'text' : 'password'}
          className="auth-input split-input icon-padded"
          value={value}
          {...props}
        />
        <button
          type="button"
          className="password-toggle-btn"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Hide password' : 'Show password'}
        >
          {visible ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
      {showStrength && value && (
        <div className="password-strength" aria-label={`Password strength ${strength} of 4`}>
          {[1, 2, 3, 4].map((n) => (
            <span key={n} className={n <= strength ? `on-${strength}` : ''} />
          ))}
        </div>
      )}
    </>
  )
})
