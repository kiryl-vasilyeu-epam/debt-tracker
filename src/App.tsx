import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { isSupabaseConfigured, supabase } from './lib/supabase'
import type { DebtRecord } from './lib/supabase'
import './App.css'

function App() {
  const [debts, setDebts] = useState<DebtRecord[]>([])
  const [person, setPerson] = useState('')
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const total = useMemo(
    () => debts.reduce((sum, entry) => sum + Number(entry.amount), 0),
    [debts],
  )

  const loadDebts = async () => {
    if (!supabase) {
      setLoading(false)
      return
    }

    const { data, error: loadError } = await supabase
      .from('debts')
      .select('*')
      .order('created_at', { ascending: false })

    if (loadError) {
      setError(loadError.message)
      setLoading(false)
      return
    }

    setDebts((data as DebtRecord[]) ?? [])
    setLoading(false)
  }

  useEffect(() => {
    const initialLoadTimer = window.setTimeout(() => {
      void loadDebts()
    }, 0)

    if (!supabase) {
      return () => {
        window.clearTimeout(initialLoadTimer)
      }
    }

    const supabaseClient = supabase

    const channel = supabaseClient
      .channel('debts-feed')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'debts' },
        () => {
          void loadDebts()
        },
      )
      .subscribe()

    return () => {
      window.clearTimeout(initialLoadTimer)
      void supabaseClient.removeChannel(channel)
    }
  }, [])

  const addDebt = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)

    if (!supabase) {
      setError('Supabase is not configured. Fill .env.local first.')
      return
    }

    const numericAmount = Number(amount)
    if (!person.trim() || Number.isNaN(numericAmount) || numericAmount <= 0) {
      setError('Please enter a name and amount greater than 0.')
      return
    }

    setSaving(true)
    const { error: insertError } = await supabase.from('debts').insert({
      person: person.trim(),
      amount: numericAmount,
      note: note.trim() || null,
    })

    setSaving(false)

    if (insertError) {
      setError(insertError.message)
      return
    }

    setPerson('')
    setAmount('')
    setNote('')
  }

  const closeDebt = async (id: string) => {
    if (!supabase) {
      return
    }

    const { error: removeError } = await supabase
      .from('debts')
      .delete()
      .eq('id', id)

    if (removeError) {
      setError(removeError.message)
    }
  }

  if (!isSupabaseConfigured) {
    return (
      <main className="app">
        <section className="card setup-card">
          <h1>Debt Tracker</h1>
          <p>
            Add your Supabase keys in <strong>.env.local</strong> to enable
            shared realtime storage.
          </p>
          <pre>
            VITE_SUPABASE_URL=https://your-project.supabase.co{`\n`}
            VITE_SUPABASE_ANON_KEY=your-public-anon-key
          </pre>
        </section>
      </main>
    )
  }

  return (
    <main className="app">
      <section className="card intro-card">
        <div>
          <h1>Debt Tracker</h1>
          <p className="subtitle">
            Shared ledger in realtime. Any user can add or close a debt and all
            open tabs receive updates instantly.
          </p>
        </div>
        <div className="total-block">
          <span>Total open debt</span>
          <strong>
            {new Intl.NumberFormat('en-US', {
              style: 'currency',
              currency: 'USD',
            }).format(total)}
          </strong>
        </div>
      </section>

      <section className="card">
        <h2>Add debt</h2>
        <form className="debt-form" onSubmit={addDebt}>
          <label>
            Person
            <input
              value={person}
              onChange={(event) => setPerson(event.target.value)}
              placeholder="Anna"
              required
            />
          </label>
          <label>
            Amount
            <input
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              type="number"
              min="0"
              step="0.01"
              placeholder="120.50"
              required
            />
          </label>
          <label className="full-width">
            Note
            <input
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Dinner payment split"
            />
          </label>
          <button disabled={saving} type="submit">
            {saving ? 'Saving...' : 'Add debt'}
          </button>
        </form>
        {error ? <p className="error">{error}</p> : null}
      </section>

      <section className="card">
        <div className="list-header">
          <h2>Open debts</h2>
          <span>{debts.length} items</span>
        </div>

        {loading ? <p>Loading...</p> : null}
        {!loading && debts.length === 0 ? (
          <p>No debts yet. Add the first one.</p>
        ) : null}

        <ul className="debts-list">
          {debts.map((entry) => (
            <li key={entry.id}>
              <div>
                <h3>{entry.person}</h3>
                <p>{entry.note || 'No note'}</p>
              </div>
              <div className="debt-meta">
                <strong>
                  {new Intl.NumberFormat('en-US', {
                    style: 'currency',
                    currency: 'USD',
                  }).format(entry.amount)}
                </strong>
                <button type="button" onClick={() => closeDebt(entry.id)}>
                  Close
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </main>
  )
}

export default App
