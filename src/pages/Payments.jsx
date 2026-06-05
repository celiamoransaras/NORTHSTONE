import { useState, useEffect } from 'react'
import { Payments as DB, Athletes } from '../lib/db'

const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

export default function Payments() {
  const [payments, setPayments] = useState([])
  const [athletes, setAthletes] = useState([])
  const [loading, setLoading] = useState(true)
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())
  const [amount, setAmount] = useState(80)
  const [editingAmount, setEditingAmount] = useState(false)

  const load = async () => {
    setLoading(true)
    const ath = await Athletes.getAll()
    setAthletes(ath)
    const pays = await DB.ensureMonth(ath, month, year, amount)
    setPayments(pays)
    setLoading(false)
  }

  useEffect(() => { load() }, [month, year])

  const toggle = async (id, currentStatus) => {
    await DB.toggle(id, currentStatus)
    const pays = await DB.getByMonth(month, year)
    setPayments(pays)
  }

  const paid = payments.filter(p => p.status === 'paid').length
  const total = payments.length
  const pct = total ? Math.round((paid / total) * 100) : 0

  const prevMonth = () => { if (month === 1) { setMonth(12); setYear(y => y-1) } else setMonth(m => m-1) }
  const nextMonth = () => { if (month === 12) { setMonth(1); setYear(y => y+1) } else setMonth(m => m+1) }
  const getAthlete = (id) => athletes.find(a => a.id === id)

  return (
    <div className="page fade-in">
      <div className="page-header">
        <h2>Pagos</h2>
        {editingAmount ? (
          <div style={{ display: 'flex', gap: 8 }}>
            <input className="input" type="number" value={amount} style={{ width: 80 }} onChange={e => setAmount(Number(e.target.value))} />
            <button className="btn btn-primary btn-sm" onClick={() => setEditingAmount(false)}>OK</button>
          </div>
        ) : (
          <button className="btn btn-secondary btn-sm" onClick={() => setEditingAmount(true)}>Cuota: {amount}€</button>
        )}
      </div>

      <div className="page-content">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '12px 16px' }}>
          <button className="btn btn-ghost btn-sm" onClick={prevMonth} style={{ fontSize: 20, padding: 8 }}>‹</button>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontWeight: 700, fontSize: 18 }}>{MONTHS[month-1]}</div>
            <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>{year}</div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={nextMonth} style={{ fontSize: 20, padding: 8 }}>›</button>
        </div>

        <div className="grid-2">
          <div className="stat-card">
            <div className="stat-value" style={{ color: 'var(--success)' }}>{paid}/{total}</div>
            <div className="stat-label">Pagos recibidos</div>
          </div>
          <div className="stat-card">
            <div className="stat-value" style={{ color: 'var(--accent)' }}>{paid * amount}€</div>
            <div className="stat-label">Cobrado este mes</div>
          </div>
        </div>

        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Progreso de cobros</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: pct === 100 ? 'var(--success)' : 'var(--text)' }}>{pct}%</span>
          </div>
          <div style={{ height: 8, background: 'var(--border)', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${pct}%`, background: pct === 100 ? 'var(--success)' : 'var(--accent)', borderRadius: 4, transition: 'width 0.4s ease' }} />
          </div>
        </div>

        {loading ? (
          <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 24 }}>Cargando...</div>
        ) : (
          <>
            {payments.filter(p => p.status === 'pending').length > 0 && (
              <>
                <div className="section-title">Pendientes</div>
                <div className="card">
                  {payments.filter(p => p.status === 'pending').map((p, i, arr) => {
                    const a = getAthlete(p.athlete_id)
                    return (
                      <div key={p.id} className="list-item" style={{ borderBottom: i < arr.length-1 ? undefined : 'none' }}
                        onClick={() => toggle(p.id, p.status)}>
                        <div className="avatar" style={{ background: a?.color+'30', color: a?.color }}>
                          {a?.name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase() || '?'}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, fontSize: 14 }}>{a?.name || 'Desconocido'}</div>
                          <div style={{ fontSize: 12, color: 'var(--error)' }}>Pendiente · {p.amount}€</div>
                        </div>
                        <div style={{ width: 28, height: 28, border: '2px solid var(--border)', borderRadius: 6 }} />
                      </div>
                    )
                  })}
                </div>
              </>
            )}

            {payments.filter(p => p.status === 'paid').length > 0 && (
              <>
                <div className="section-title" style={{ marginTop: 8 }}>Pagados</div>
                <div className="card">
                  {payments.filter(p => p.status === 'paid').map((p, i, arr) => {
                    const a = getAthlete(p.athlete_id)
                    return (
                      <div key={p.id} className="list-item" style={{ borderBottom: i < arr.length-1 ? undefined : 'none', opacity: 0.7 }}
                        onClick={() => toggle(p.id, p.status)}>
                        <div className="avatar" style={{ background: a?.color+'30', color: a?.color }}>
                          {a?.name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase() || '?'}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, fontSize: 14 }}>{a?.name || 'Desconocido'}</div>
                          <div style={{ fontSize: 12, color: 'var(--success)' }}>Pagado ✓ · {p.amount}€</div>
                        </div>
                        <div style={{ width: 28, height: 28, background: 'var(--success)', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 16 }}>✓</div>
                      </div>
                    )
                  })}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}
