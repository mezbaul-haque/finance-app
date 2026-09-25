import test from 'node:test'
import assert from 'node:assert/strict'
import { summarizeMonth } from '../src/lib/monthlyInsights.ts'

const transaction = (amount, kind = 'expense', occurred_on = '2026-09-01', category_id = 'food') => ({ id: crypto.randomUUID(), amount, kind, occurred_on, category_id })

test('monthly totals include every expense, exclude transfers and other months, and retain cents', () => {
  const result = summarizeMonth([
    ...Array.from({ length: 1200 }, () => transaction(0.1)),
    transaction(0.2), transaction(50, 'income'), transaction(1000, 'transfer'),
    transaction(900, 'expense', '2026-08-31'), transaction(800, 'expense', '2026-10-01'),
  ], '2026-09')
  assert.equal(result.spending, 120.2)
  assert.equal(result.income, 50)
  assert.equal(result.expenseCount, 1201)
  assert.equal(result.categorySpending.get('food'), 120.2)
  assert.deepEqual(result.daily[0], { day: 1, spending: 120.2 })
  assert.deepEqual(result.daily[29], { day: 30, spending: 0 })
})

test('category and daily totals reconcile, including uncategorized expenses', () => {
  const result = summarizeMonth([transaction(10), transaction(20, 'expense', '2026-09-30', 'housing'), transaction(3.25, 'expense', '2026-09-02', null)], '2026-09')
  assert.equal(result.categorySpending.get(null), 3.25)
  assert.equal([...result.categorySpending.values()].reduce((sum, value) => sum + value, 0), result.spending)
  assert.equal(result.daily.reduce((sum, value) => sum + value.spending, 0), result.spending)
})

test('empty months and calendar boundaries have the correct days', () => {
  for (const [month, days] of [['2024-02', 29], ['2026-02', 28], ['2026-12', 31], ['2027-01', 31]]) {
    const result = summarizeMonth([], month)
    assert.equal(result.daily.length, days)
    assert.equal(result.spending, 0)
    assert.equal(result.income, 0)
    assert.equal(result.expenseCount, 0)
  }
})
