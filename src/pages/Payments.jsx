import { useState, useEffect } from 'react'
import { Payments as DB, Athletes } from '../lib/db'

const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

export default function Payments() {
  const [payments, setPayments] = useState([])
  const [athletes, setAthletes] = useState([])
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())
  const [amount, setAmount] = useState(80)
  const [editingAmount, setEditingAmount] = useState(false)

  const load = () => { setPayments(DB.getAll()); setAthletes(Athletes.getAll()) }
  useEffect(() => { load() }, [])

  const monthPayments = payments.filter(p => p.month === month && p.year === year)

  // Ensure all athletes have a payment record for this month
  useEffect(() => {
    if (!athletes.length) return
    athletes.forEach(a => {
      const existing = payments.find(p => p.athlete_id === a.id && p.month === month && p.year === year)
      if (!existing) {
        DB.create({ athlete_id: a.id, month, year, amount, status: 'pending' })
      }
    })
    setPayments(DB.getAll())
  }, [athletes, month, year])

  const toggle = (id) => { DB.toggle(id); load() }

  const paid = monthPayments.filter(p => p.status === 'paid').length
  const total = monthPayments.length
  const pct = total ? Math.round((paid / total) * 100) : 0
  const collected = paid * amount

  const prevMonth = () => {
    if (month === 1) { setMonth(12); setYear(y => y - 1) }
    else setMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (month === 12) { setMonth(1); setYear(y => y + 1) }
    else setMonth(m => m + 1)
  }

  const getAthlete = (id) => athletes.find(a => a.id === id)

  return (
    <div className="page fade-in" style={{ overflowY: 'auto', height: '100%' }}>
      <div className="page-header">
        <h2>Pagos</h2>
        {editingAmount ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input className="input" type="number" value={amount} style={{ width: 80 }}
              onChange={e => setAmount(Number(e.target.value))} />
            <button className="btn btn-primary btn-sm" onClick={() => setEditingAmount(false)}>OK</button>
          </div>
        ) : (
          <button className="btn btn-secondary btn-sm" onClick={() => setEditingAmount(true)}>
            Cuota: {amount}€
          </button>
        )}
      </div>

      <div className="page-content">
        {/* Month selector */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '12px 16px' }}>
          <button className="btn btn-ghost btn-sm btn-icon" onClick={prevMonth} style={{ padding: 8, fontSize: 20 }}>‹</button>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontWeight: 700, fontSize: 18 }}>{MONTHS[month - 1]}</div>
            <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>{year}</div>
          </div>
          <button className="btn btn-ghost btn-sm btn-icon" onClick={nextMonth} style={{ padding: 8, fontSize: 20 }}>›</button>
        </div>

        {/* Summary */}
        <div className="grid-2">
          <div className="stat-card">
            <div className="stat-value" style={{ color: 'var(--success)' }}>{paid}/{total}</div>
            <div className="stat-label">Pagos recibidos</div>
          </div>
          <div className="stat-card">
            <div className="stat-value" style={{ color: 'var(--accent)' }}>{collected}€</div>
            <div className="stat-label">Cobrado este mes</div>
          </div>
        </div>

        {/* Progress bar */}
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Progreso de cobros</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: pct === 100 ? 'var(--success)' : 'var(--text)' }}>{pct}%</span>
          </div>
          <div style={{ height: 8, background: 'var(--border)', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${pct}%`, background: pct === 100 ? 'var(--success)' : 'var(--accent)', borderRadius: 4, transition: 'width 0.4s ease' }} />
          </div>
        </div>

        {/* List */}
        {monthPayments.length === 0 ? (
          <div className="empty-state">
            <div className="icon">💳</div>
            <h3>Sin deportistas</h3>
            <p>Añade deportistas desde la sección Equipo</p>
          </div>
        ) : (
          <>
            {/* Pending */}
            {monthPayments.filter(p => p.status === 'pending').length > 0 && (
              <>
                <div className="section-title">Pendientes</div>
                <div className="card">
                  {monthPayments.filter(p => p.status === 'pending').map((p, i, arr) => {
                    const a = getAthlete(p.athlete_id)
                    return (
                      <div key={p.id} className="list-item"
                        style={{ borderBottom: i < arr.length - 1 ? undefined : 'none' }}
                        onClick={() => toggle(p.id)}>
                        <div className="avatar" style={{ background: a?.color + '30' || 'var(--card-hover)', color: a?.color }}>
                          {a?.name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase() || '?'}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, fontSize: 14 }}>{a?.name || 'Desconocido'}</div>
                          <div style={{ fontSize: 12, color: 'var(--error)' }}>Pendiente · {p.amount}€</div>
                        </div>
                        <div style={{
                          width: 28, height: 28, border: '2px solid var(--border)',
                          borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }} />
                      </div>
                    )
                  })}
                </div>
              </>
            )}

            {/* Paid */}
            {monthPayments.filter(p => p.status === 'paid').length > 0 && (
              <>
                <div className="section-title" style={{ marginTop: 8 }}>Pagados</div>
                <div className="card">
                  {monthPayments.filter(p => p.status === 'paid').map((p, i, arr) => {
                    const a = getAthlete(p.athlete_id)
                    return (
                      <div key={p.id} className="list-item"
                        style={{ borderBottom: i < arr.length - 1 ? undefined : 'none', opacity: 0.7 }}
                        onClick={() => toggle(p.id)}>
                        <div className="avatar" style={{ background: a?.color + '30' || 'var(--card-hover)', color: a?.color }}>
                          {a?.name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase() || '?'}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, fontSize: 14 }}>{a?.name || 'Desconocido'}</div>
                          <div style={{ fontSize: 12, color: 'var(--success)' }}>
                            Pagado ✓ · {p.amount}€
                          </div>
                        </div>
                        <div style={{
                          width: 28, height: 28, background: 'var(--success)',
                          borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: '#fff', fontSize: 16
                        }}>✓</div>
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
