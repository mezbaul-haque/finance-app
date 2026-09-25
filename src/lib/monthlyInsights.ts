export type MonthlyTransaction = {
  id: string
  category_id: string | null
  kind: 'income' | 'expense' | 'transfer'
  amount: number
  occurred_on: string
}

export function summarizeMonth(transactions: MonthlyTransaction[], month: string) {
  const [year, monthNumber] = month.split('-').map(Number)
  const dailyCents = Array<number>(new Date(year, monthNumber, 0).getDate()).fill(0)
  const categoryCents = new Map<string | null, number>()
  let incomeCents = 0
  let spendingCents = 0
  let expenseCount = 0
  for (const transaction of transactions) {
    if (!transaction.occurred_on.startsWith(`${month}-`)) continue
    const cents = Math.round(Number(transaction.amount) * 100)
    if (transaction.kind === 'income') incomeCents += cents
    if (transaction.kind !== 'expense') continue
    expenseCount++
    spendingCents += cents
    categoryCents.set(transaction.category_id, (categoryCents.get(transaction.category_id) ?? 0) + cents)
    dailyCents[Number(transaction.occurred_on.slice(-2)) - 1] += cents
  }
  return {
    income: incomeCents / 100,
    spending: spendingCents / 100,
    expenseCount,
    categorySpending: new Map([...categoryCents].map(([id, cents]) => [id, cents / 100])),
    daily: dailyCents.map((cents, index) => ({ day: index + 1, spending: cents / 100 })),
  }
}
