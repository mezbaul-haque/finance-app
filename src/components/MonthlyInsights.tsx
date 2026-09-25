import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { supabase } from '../lib/supabase'
import './MonthlyInsights.css'
import { summarizeMonth } from '../lib/monthlyInsights'
import type { MonthlyTransaction } from '../lib/monthlyInsights'

type Category = { id: string; name: string }
type Budget = { category_id: string; amount: number }
type MonthData = { categories: Category[]; budgets: Budget[]; transactions: MonthlyTransaction[] }
const money = (value: number) => `BDT ${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export function MonthlyInsights({ userId, revision }: { userId: string; revision: number }) {
  const today = new Date()
  const [month, setMonth] = useState(`${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`)
  return <section className="monthly-panel" aria-labelledby="monthly-title">
    <div className="monthly-heading"><div><p className="eyebrow">PLAN & REVIEW</p><h2 id="monthly-title">Your month in focus</h2></div>
      <label>Month<input type="month" value={month} min="1900-01" max="9998-12" onChange={event => { if (/^\d{4}-\d{2}$/.test(event.target.value) && event.target.validity.valid) setMonth(event.target.value) }} /></label>
    </div>
    <MonthContent key={`${userId}-${month}-${revision}`} userId={userId} month={month} />
  </section>
}

function MonthContent({ userId, month }: { userId: string; month: string }) {
  const [data, setData] = useState<MonthData | null>(null)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [view, setView] = useState<'insights' | 'budgets'>('insights')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [categoryId, setCategoryId] = useState('')
  const [amount, setAmount] = useState('')
  const monthStart = `${month}-01`
  const [year, monthNumber] = month.split('-').map(Number)
  const nextMonth = monthNumber === 12 ? `${year + 1}-01-01` : `${year}-${String(monthNumber + 1).padStart(2, '0')}-01`

  useEffect(() => {
    let active = true
    async function load() {
      try {
        const [categories, budgets] = await Promise.all([
          supabase.from('categories').select('id, name').eq('user_id', userId).eq('kind', 'expense').order('name').returns<Category[]>(),
          supabase.from('budgets').select('category_id, amount').eq('user_id', userId).eq('month_start', monthStart).returns<Budget[]>(),
        ])
        if (categories.error) throw categories.error
        if (budgets.error) throw budgets.error
        const transactions: MonthlyTransaction[] = []
        // Page through the whole month instead of using the recent-transactions limit.
        for (let offset = 0; ; offset += 500) {
          const page = await supabase.from('transactions').select('id, category_id, kind, amount, occurred_on')
            .eq('user_id', userId).gte('occurred_on', monthStart).lt('occurred_on', nextMonth)
            .order('id').range(offset, offset + 499).returns<MonthlyTransaction[]>()
          if (page.error) throw page.error
          if (!active) return
          transactions.push(...page.data)
          if (page.data.length < 500) break
        }
        if (active) setData({ categories: categories.data, budgets: budgets.data, transactions })
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : 'Could not load monthly data. Please try again.')
      }
    }
    void load()
    return () => { active = false }
  }, [userId, monthStart, nextMonth, attempt])

  async function saveBudget(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const value = Number(amount)
    if (!data || !data.categories.some(category => category.id === categoryId) || !Number.isFinite(value) || value <= 0 || value > 999999999999.99 || !/^\d+(\.\d{1,2})?$/.test(amount)) {
      setMessage('Choose an expense category and enter a positive amount with up to two decimal places.')
      return
    }
    setBusy(true)
    setMessage('')
    try {
      const result = await supabase.from('budgets').upsert({ user_id: userId, category_id: categoryId, month_start: monthStart, amount: value }, { onConflict: 'user_id,category_id,month_start' }).select('category_id, amount').single<Budget>()
      if (result.error) throw result.error
      setData(current => current && ({ ...current, budgets: [...current.budgets.filter(budget => budget.category_id !== categoryId), result.data] }))
      setMessage('Budget saved for this month.')
    } catch { setMessage('Could not save the budget. Please try again.') }
    finally { setBusy(false) }
  }

  async function removeBudget(id: string) {
    setBusy(true)
    setMessage('')
    try {
      const result = await supabase.from('budgets').delete().eq('user_id', userId).eq('month_start', monthStart).eq('category_id', id).select('category_id')
      if (result.error || !result.data?.length) throw new Error('Budget was not removed')
      setData(current => current && ({ ...current, budgets: current.budgets.filter(budget => budget.category_id !== id) }))
      if (id === categoryId) setAmount('')
      setMessage('Budget removed for this month.')
    } catch { setMessage('Could not remove the budget. Please try again.') }
    finally { setBusy(false) }
  }

  if (error) return <div role="alert"><p>{error}</p><button className="text-button" onClick={() => { setError(''); setAttempt(value => value + 1) }}>Retry monthly data</button></div>
  if (!data) return <p role="status">Loading monthly insights…</p>

  const { spending, income, categorySpending, daily, expenseCount } = summarizeMonth(data.transactions, month)
  const rows = data.categories.map(category => ({
    ...category,
    spent: categorySpending.get(category.id) ?? 0,
    budget: Number(data.budgets.find(budget => budget.category_id === category.id)?.amount) || 0,
  }))
  const uncategorized = [...categorySpending].filter(([id]) => !rows.some(row => row.id === id)).reduce((sum, [, value]) => sum + Math.round(value * 100), 0) / 100
  const chartRows = [...rows.filter(row => row.spent || row.budget), ...(uncategorized ? [{ id: 'uncategorized', name: 'Uncategorized', spent: uncategorized, budget: 0 }] : [])]
  const budgetStatus = (spent: number, budget: number) => !budget ? 'No budget set' : spent > budget ? `${money(spent - budget)} over budget` : spent === budget ? 'Budget reached' : `${money(budget - spent)} remaining${spent >= budget * 0.8 ? ' · Near limit (80%+)' : ''}`

  return <>
    <div className="monthly-switch" aria-label="Monthly view">
      <button className="text-button" aria-pressed={view === 'insights'} onClick={() => setView('insights')}>Monthly insights</button>
      <button className="text-button" aria-pressed={view === 'budgets'} onClick={() => setView('budgets')}>Budget settings</button>
    </div>
    <div className="monthly-totals">
      <div><span>Recorded income</span><strong>{money(income)}</strong></div>
      <div><span>Recorded spending</span><strong>{money(spending)}</strong></div>
      <div><span>Net income</span><strong>{money(income - spending)}</strong></div>
    </div>
    <p className="monthly-note">Based on recorded transactions for {month}. Transfers and opening balances are excluded. Budgets apply only to the selected month; unbudgeted spending is still included.</p>
    {view === 'insights' ? <>
      {!expenseCount && <p>No expenses recorded this month. Record an expense to see your spending charts.</p>}
      <div className="monthly-charts">
        <div><h3>Category spending vs. budget</h3>{chartRows.length ? <div className="monthly-chart" style={{ height: Math.max(260, chartRows.length * 60) }}><ResponsiveContainer width="100%" height="100%"><BarChart data={chartRows} layout="vertical" margin={{ left: 10, right: 15 }} accessibilityLayer><CartesianGrid strokeDasharray="3 3" /><XAxis type="number" /><YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 12 }} /><Tooltip formatter={value => money(Number(value))} /><Legend /><Bar dataKey="spent" name="Spent (BDT)" fill="#1a5d4d" /><Bar dataKey="budget" name="Budget (BDT)" fill="#b4ad64" /></BarChart></ResponsiveContainer></div> : <p>Set a category budget to begin planning.</p>}</div>
        <div><h3>Daily spending</h3>{expenseCount > 0 && <div className="monthly-chart"><ResponsiveContainer width="100%" height="100%"><LineChart data={daily} margin={{ left: 10, right: 15 }} accessibilityLayer><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="day" /><YAxis width={75} /><Tooltip labelFormatter={label => `Day ${label}`} formatter={value => money(Number(value))} /><Line type="linear" dataKey="spending" name="Spending (BDT)" stroke="#1a5d4d" strokeWidth={2} dot={false} /></LineChart></ResponsiveContainer></div>}</div>
      </div>
      <details><summary>Daily spending data</summary><div className="monthly-table"><table><thead><tr><th>Day</th><th>Spending</th></tr></thead><tbody>{daily.map(day => <tr key={day.day}><td>{month}-{String(day.day).padStart(2, '0')}</td><td>{money(day.spending)}</td></tr>)}</tbody></table></div></details>
    </> : <form className="budget-form" onSubmit={saveBudget}>
      <h3>Set a category budget</h3><p>Saving an existing category replaces its budget for {month}.</p>
      <fieldset disabled={busy || !data.categories.length}>
        <label>Expense category<select required value={categoryId} onChange={event => { setCategoryId(event.target.value); setAmount(String(data.budgets.find(budget => budget.category_id === event.target.value)?.amount ?? '')); setMessage('') }}><option value="">Choose a category</option>{data.categories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
        <label>Monthly limit (BDT)<input type="number" required min="0.01" max="999999999999.99" step="0.01" value={amount} onChange={event => setAmount(event.target.value)} /></label>
        <button type="submit" className="primary-button">{busy ? 'Saving…' : 'Save budget'}</button>
      </fieldset>
      {!data.categories.length && <p>No expense categories available.</p>}
    </form>}
    {message && <p className="form-message" role="status">{message}</p>}
    <h3>Category budget progress</h3>
    <div className="monthly-table"><table><thead><tr><th>Category</th><th>Spent</th><th>Budget</th><th>Status</th>{view === 'budgets' && <th>Action</th>}</tr></thead><tbody>
      {[...rows, ...(uncategorized ? [{ id: 'uncategorized', name: 'Uncategorized', spent: uncategorized, budget: 0 }] : [])].map(row => <tr key={row.id}><th scope="row">{row.name}</th><td>{money(row.spent)}</td><td>{row.budget ? money(row.budget) : '—'}</td><td className={row.budget && row.spent >= row.budget ? 'budget-alert' : ''}>{budgetStatus(row.spent, row.budget)}</td>{view === 'budgets' && <td>{row.budget > 0 && <button className="text-button" disabled={busy} onClick={() => void removeBudget(row.id)} aria-label={`Remove ${row.name} budget`}>Remove</button>}</td>}</tr>)}
    </tbody></table></div>
  </>
}
