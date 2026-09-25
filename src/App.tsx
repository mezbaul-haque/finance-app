import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import './App.css'
import { MonthlyInsights } from './components/MonthlyInsights'

type AuthMode = 'sign-in' | 'sign-up'
type Message = { kind: 'error' | 'success'; text: string } | null

type Account = {
  id: string
  name: string
  kind: string
  opening_balance: number
}

type Category = {
  id: string
  name: string
  kind: 'income' | 'expense'
  color: string
}

type Transaction = {
  id: string
  amount: number
  kind: 'income' | 'expense' | 'transfer'
  occurred_on: string
  merchant: string | null
  note: string | null
  accounts?: { name: string } | null
  categories?: { name: string } | null
}

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
  return session ? <Dashboard key={session.user.id} session={session} /> : <AuthScreen />
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
  const [insightsRevision, setInsightsRevision] = useState(0)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [newAccountName, setNewAccountName] = useState('')
  const [newAccountBalance, setNewAccountBalance] = useState('0')
  const [txAmount, setTxAmount] = useState('')
  const [txMerchant, setTxMerchant] = useState('')
  const [txAccountId, setTxAccountId] = useState('')
  const [txCategoryId, setTxCategoryId] = useState('')
  const [txKind, setTxKind] = useState<'income' | 'expense'>('expense')
  const [statusMessage, setStatusMessage] = useState<string | null>(null)

  const userId = session.user.id

  const loadData = async () => {
    const { data: accs } = await supabase.from('accounts').select('*').eq('user_id', userId)
    if (accs) {
      setAccounts(accs)
      if (accs.length > 0 && !txAccountId) setTxAccountId(accs[0].id)
    }

    const { data: cats } = await supabase.from('categories').select('*').eq('user_id', userId)
    if (cats) {
      setCategories(cats)
      const defaultCat = cats.find(c => c.kind === txKind)
      if (defaultCat && !txCategoryId) setTxCategoryId(defaultCat.id)
    }

    const { data: txs } = await supabase
      .from('transactions')
      .select('id, amount, kind, occurred_on, merchant, note, accounts(name), categories(name)')
      .eq('user_id', userId)
      .order('occurred_on', { ascending: false })
      .limit(10)
    if (txs) setTransactions(txs as unknown as Transaction[])
  }

  useEffect(() => {
    void loadData()
  }, [userId])

  const handleSignOut = async () => { setIsSigningOut(true); await supabase.auth.signOut(); setIsSigningOut(false) }
  const name = session.user.user_metadata.display_name || session.user.email?.split('@')[0] || 'there'

  const handleCreateAccount = async (e: FormEvent) => {
    e.preventDefault()
    if (!newAccountName.trim()) return
    const { error } = await supabase.from('accounts').insert({
      user_id: userId,
      name: newAccountName.trim(),
      kind: 'bank',
      opening_balance: parseFloat(newAccountBalance) || 0
    })
    if (error) {
      setStatusMessage(`Error creating account: ${error.message}`)
    } else {
      setNewAccountName('')
      setNewAccountBalance('0')
      setStatusMessage('Account created successfully!')
      await loadData()
    }
  }

  const handleCreateTransaction = async (e: FormEvent) => {
    e.preventDefault()
    if (!txAmount || !txAccountId || !txCategoryId) {
      setStatusMessage('Please fill in amount, account, and category.')
      return
    }
    const { error } = await supabase.from('transactions').insert({
      user_id: userId,
      account_id: txAccountId,
      category_id: txCategoryId,
      kind: txKind,
      amount: parseFloat(txAmount),
      occurred_on: new Date().toISOString().split('T')[0],
      merchant: txMerchant.trim() || null
    })
    if (error) {
      setStatusMessage(`Error creating transaction: ${error.message}`)
    } else {
      setTxAmount('')
      setTxMerchant('')
      setStatusMessage('Transaction recorded successfully!')
      setInsightsRevision(value => value + 1)
      await loadData()
    }
  }

  return (
    <main className="dashboard-shell">
      <header className="dashboard-header"><a className="brand" href="/" aria-label="Finance App dashboard"><span className="brand-mark" aria-hidden="true">ƒ</span><span>finance</span></a><button className="text-button" disabled={isSigningOut} onClick={handleSignOut} type="button">{isSigningOut ? 'Signing out…' : 'Sign out'}</button></header>
      <section className="dashboard-welcome"><p className="eyebrow">YOUR FINANCIAL WORKSPACE</p><h1>Good to see you, {name}.</h1><p>Manage your accounts, record transactions, and stay on top of your budget.</p></section>

      {statusMessage && <div className="status-banner" style={{ margin: '1rem 2rem', padding: '0.75rem', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '6px', color: '#166534' }}>{statusMessage}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem', padding: '0 2rem 2rem' }}>
        {/* Accounts Section */}
        <section style={{ background: '#fff', padding: '1.5rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
          <h2>Accounts</h2>
          <ul style={{ listStyle: 'none', padding: 0, margin: '1rem 0' }}>
            {accounts.map(acc => (
              <li key={acc.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid #f1f5f9' }}>
                <span>{acc.name}</span>
                <span style={{ fontWeight: 600 }}>BDT {acc.opening_balance.toLocaleString()}</span>
              </li>
            ))}
            {accounts.length === 0 && <p style={{ color: '#64748b' }}>No accounts yet. Add your first account below.</p>}
          </ul>
          <form onSubmit={handleCreateAccount} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1rem' }}>
            <input type="text" placeholder="Account Name (e.g. Primary Bank)" value={newAccountName} onChange={e => setNewAccountName(e.target.value)} required style={{ padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '4px' }} />
            <input type="number" placeholder="Opening Balance" value={newAccountBalance} onChange={e => setNewAccountBalance(e.target.value)} step="0.01" required style={{ padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '4px' }} />
            <button type="submit" className="primary-button" style={{ padding: '0.5rem 1rem' }}>Add Account</button>
          </form>
        </section>

        {/* Transactions Section */}
        <section style={{ background: '#fff', padding: '1.5rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
          <h2>Record Transaction</h2>
          <form onSubmit={handleCreateTransaction} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1rem' }}>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <label><input type="radio" name="kind" checked={txKind === 'expense'} onChange={() => { setTxKind('expense'); const cat = categories.find(c => c.kind === 'expense'); if (cat) setTxCategoryId(cat.id); }} /> Expense</label>
              <label><input type="radio" name="kind" checked={txKind === 'income'} onChange={() => { setTxKind('income'); const cat = categories.find(c => c.kind === 'income'); if (cat) setTxCategoryId(cat.id); }} /> Income</label>
            </div>
            <input type="number" placeholder="Amount (BDT)" value={txAmount} onChange={e => setTxAmount(e.target.value)} step="0.01" required style={{ padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '4px' }} />
            <input type="text" placeholder="Merchant / Source (optional)" value={txMerchant} onChange={e => setTxMerchant(e.target.value)} style={{ padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '4px' }} />
            <select value={txAccountId} onChange={e => setTxAccountId(e.target.value)} required style={{ padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '4px' }}>
              <option value="" disabled>Select Account</option>
              {accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.name}</option>)}
            </select>
            <select value={txCategoryId} onChange={e => setTxCategoryId(e.target.value)} required style={{ padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '4px' }}>
              <option value="" disabled>Select Category</option>
              {categories.filter(c => c.kind === txKind).map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
            </select>
            <button type="submit" className="primary-button" style={{ padding: '0.5rem 1rem' }}>Record Transaction</button>
          </form>
        </section>
      </div>

      <MonthlyInsights userId={userId} revision={insightsRevision} />

      {/* Recent Transactions */}
      <section style={{ margin: '0 2rem 2rem', background: '#fff', padding: '1.5rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
        <h2>Recent Transactions</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '1rem' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #e2e8f0', textAlign: 'left' }}>
              <th style={{ padding: '0.5rem' }}>Date</th>
              <th style={{ padding: '0.5rem' }}>Merchant / Source</th>
              <th style={{ padding: '0.5rem' }}>Category</th>
              <th style={{ padding: '0.5rem' }}>Account</th>
              <th style={{ padding: '0.5rem', textAlign: 'right' }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map(tx => (
              <tr key={tx.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '0.5rem' }}>{tx.occurred_on}</td>
                <td style={{ padding: '0.5rem' }}>{tx.merchant || '—'}</td>
                <td style={{ padding: '0.5rem' }}>{tx.categories?.name || '—'}</td>
                <td style={{ padding: '0.5rem' }}>{tx.accounts?.name || '—'}</td>
                <td style={{ padding: '0.5rem', textAlign: 'right', color: tx.kind === 'income' ? '#16a34a' : '#dc2626', fontWeight: 600 }}>
                  {tx.kind === 'income' ? '+' : '-'}BDT {Number(tx.amount).toLocaleString()}
                </td>
              </tr>
            ))}
            {transactions.length === 0 && (
              <tr>
                <td colSpan={5} style={{ padding: '1rem', textAlign: 'center', color: '#64748b' }}>No transactions recorded yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </main>
  )
}

export default App
