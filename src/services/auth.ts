import { appUrl, supabase } from '../lib/supabase'

function authError(message: string): Error {
  // Map Supabase Auth messages to friendlier copy.
  if (/invalid login credentials/i.test(message)) return new Error('Incorrect email or password.')
  if (/email not confirmed/i.test(message)) {
    return new Error('Please verify your email address first — check your inbox for the link.')
  }
  if (/already registered/i.test(message)) return new Error('An account with this email already exists.')
  if (/rate limit/i.test(message)) return new Error('Too many attempts. Please wait a minute and try again.')
  return new Error(message)
}

export async function signUp(input: {
  email: string
  password: string
  fullName: string
  phone?: string
}) {
  const { data, error } = await supabase.auth.signUp({
    email: input.email.trim(),
    password: input.password,
    options: {
      emailRedirectTo: `${appUrl}/dashboard`,
      // Read by the on_auth_user_created trigger to fill the profile row.
      data: { full_name: input.fullName.trim(), phone: input.phone?.trim() || null },
    },
  })
  if (error) throw authError(error.message)
  // Supabase returns a user with no identities when the email is taken
  // (to avoid leaking which emails exist) — treat it as a duplicate.
  if (data.user && data.user.identities?.length === 0) {
    throw new Error('An account with this email already exists.')
  }
  return data
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  })
  if (error) throw authError(error.message)
  return data
}

export async function signInWithGoogle(redirectPath = '/dashboard') {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${appUrl}${redirectPath}` },
  })
  if (error) throw authError(error.message)
}

export async function signOut(scope: 'local' | 'global' = 'local') {
  const { error } = await supabase.auth.signOut({ scope })
  if (error) throw authError(error.message)
}

export async function resetPassword(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: `${appUrl}/reset-password`,
  })
  if (error) throw authError(error.message)
}

export async function updatePassword(newPassword: string) {
  const { error } = await supabase.auth.updateUser({ password: newPassword })
  if (error) throw authError(error.message)
}

export async function resendVerification(email: string) {
  const { error } = await supabase.auth.resend({
    type: 'signup',
    email: email.trim(),
    options: { emailRedirectTo: `${appUrl}/dashboard` },
  })
  if (error) throw authError(error.message)
}
