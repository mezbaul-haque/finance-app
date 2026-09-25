import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import './App.css'

type AuthMode = 'sign-in' | 'sign-up'
type Message = { kind: 'error' | 'success'; text: string } | null

function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [isLoadingSession, setIsLoadingSession] = useState(true)

  useEffect(() => {
    let isMounted = true
    void supabase.auth.getSession().then(({ data: { session } }) => {
      if (isMounted) {
        setSession(session)
        setIsLoadingSession(false)
      }
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setIsLoadingSession(false)
    })
    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [])

  if (isLoadingSession) return <LoadingScreen />
  return session ? <Dashboard session={session} /> : <AuthScreen />
}

function LoadingScreen() {
  return <main className="loading-screen" aria-live="polite"><div className="brand-mark" aria-hidden="true">ƒ</div><p>Preparing your financial workspace…</p></main>
}

function AuthScreen() {
  const [mode, setMode] = useState<AuthMode>('sign-in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [message, setMessage] = useState<Message>(null)
  const isSignUp = mode === 'sign-up'

  const changeMode = (nextMode: AuthMode) => { setMode(nextMode); setMessage(null) }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setMessage(null)
    setIsSubmitting(true)

    if (isSignUp) {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { display_name: displayName.trim() || undefined }, emailRedirectTo: window.location.origin },
      })
      if (error) setMessage({ kind: 'error', text: error.message })
      else if (!data.session) setMessage({ kind: 'success', text: 'Check your inbox to confirm your email, then sign in.' })
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setMessage({ kind: 'error', text: error.message })
    }
    setIsSubmitting(false)
  }

  return (
    <main className="auth-layout">
      <section className="intro-panel">
        <a className="brand" href="/" aria-label="Finance App home"><span className="brand-mark" aria-hidden="true">ƒ</span><span>finance</span></a>
        <div className="intro-copy">
          <p className="eyebrow">YOUR MONEY, CLEARER</p>
          <h1>Make every decision feel considered.</h1>
          <p className="lede">Build a complete picture of your earnings and spending, then use it to make purchases with confidence.</p>
        </div>
        <div className="principles" aria-label="What Finance App helps with">
          <div><span>01</span><p>See where your money is going</p></div>
          <div><span>02</span><p>Stay ahead of your monthly budget</p></div>
          <div><span>03</span><p>Evaluate purchases in context</p></div>
        </div>
      </section>
      <section className="auth-panel" aria-labelledby="auth-title">
        <div className="auth-card">
          <div className="auth-heading">
            <p className="eyebrow">PERSONAL FINANCE, SIMPLIFIED</p>
            <h2 id="auth-title">{isSignUp ? 'Create your space' : 'Welcome back'}</h2>
            <p>{isSignUp ? 'Start building a clearer relationship with your money.' : 'Sign in to continue to your financial workspace.'}</p>
          </div>
          <form onSubmit={handleSubmit} className="auth-form">
            {isSignUp && <label>Name <span className="optional">optional</span><input autoComplete="name" name="name" onChange={(event) => setDisplayName(event.target.value)} placeholder="What should we call you?" type="text" value={displayName} /></label>}
            <label>Email address<input autoComplete="email" name="email" onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" required type="email" value={email} /></label>
            <label>Password<input autoComplete={isSignUp ? 'new-password' : 'current-password'} minLength={6} name="password" onChange={(event) => setPassword(event.target.value)} placeholder={isSignUp ? 'At least 6 characters' : 'Your password'} required type="password" value={password} /></label>
            {message && <p className={`form-message ${message.kind}`} role="status">{message.text}</p>}
            <button className="primary-button" disabled={isSubmitting} type="submit">{isSubmitting ? 'Please wait…' : isSignUp ? 'Create account' : 'Sign in'}</button>
          </form>
          <p className="mode-switch">{isSignUp ? 'Already have an account?' : 'New to Finance App?'} <button onClick={() => changeMode(isSignUp ? 'sign-in' : 'sign-up')} type="button">{isSignUp ? 'Sign in' : 'Create an account'}</button></p>
        </div>
      </section>
    </main>
  )
}

function Dashboard({ session }: { session: Session }) {
  const [isSigningOut, setIsSigningOut] = useState(false)
  const handleSignOut = async () => { setIsSigningOut(true); await supabase.auth.signOut(); setIsSigningOut(false) }
  const name = session.user.user_metadata.display_name || session.user.email?.split('@')[0] || 'there'

  return (
    <main className="dashboard-shell">
      <header className="dashboard-header"><a className="brand" href="/" aria-label="Finance App dashboard"><span className="brand-mark" aria-hidden="true">ƒ</span><span>finance</span></a><button className="text-button" disabled={isSigningOut} onClick={handleSignOut} type="button">{isSigningOut ? 'Signing out…' : 'Sign out'}</button></header>
      <section className="dashboard-welcome"><p className="eyebrow">YOUR FINANCIAL WORKSPACE</p><h1>Good to see you, {name}.</h1><p>Your account is secure and ready. Next, we’ll bring in your first financial details.</p></section>
      <section className="getting-started" aria-labelledby="next-title"><div><p className="eyebrow">NEXT UP</p><h2 id="next-title">Build your money picture</h2><p>Add accounts, income, and expenses to unlock useful monthly insights.</p></div><div className="setup-steps"><p><span>1</span>Add an account</p><p><span>2</span>Record a transaction</p><p><span>3</span>Review your month</p></div></section>
    </main>
  )
}

export default App
