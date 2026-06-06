import { useState, useEffect } from 'react'
import { Payments as DB, Athletes } from '../lib/db'
import { useToast } from '../contexts/ToastContext'
import { haptic } from '../lib/haptic'

const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

export default function Payments() {
  const [payments, setPayments] = useState([])
  const [athletes, setAthletes] = useState([])
  const [loading, setLoading] = useState(true)
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())
  const [amount, setAmount] = useState(() => Number(localStorage.getItem('ns_payment_amount') || 80))
  const [editingAmount, setEditingAmount] = useState(false)
  const [toggling, setToggling] = useState(null)
  const toast = useToast()

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
    setToggling(id)
    try {
      await DB.toggle(id, currentStatus)
      const pays = await DB.getByMonth(month, year)
      setPayments(pays)
      haptic('success')
      toast(currentStatus === 'pending' ? '✓ Pago registrado' : 'Pago marcado como pendiente')
    } catch {
      toast('Error al actualizar el pago', 'error')
      haptic('error')
    } finally {
      setToggling(null)
    }
  }

  const paid = payments.filter(p => p.status === 'paid').length
  const total = payments.length
  const pct = total ? Math.round((paid / total) * 100) : 0
  const pending = payments.filter(p => p.status === 'pending')
  const paidList = payments.filter(p => p.status === 'paid')

  const prevMonth = () => { if (month === 1) { setMonth(12); setYear(y => y-1) } else setMonth(m => m-1) }
  const nextMonth = () => { if (month === 12) { setMonth(1); setYear(y => y+1) } else setMonth(m => m+1) }
  const getAthlete = (id) => athletes.find(a => a.id === id)
  const initials = (name) => name?.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase() || '?'

  if (loading) return (
    <div className="page">
      <div className="page-header"><div className="skeleton" style={{ height: 28, width: 100 }} /></div>
      <div className="page-content">
        <div className="skeleton" style={{ height: 64, borderRadius: 18 }} />
        <div className="grid-2">
          <div className="skeleton" style={{ height: 88, borderRadius: 18 }} />
          <div className="skeleton" style={{ height: 88, borderRadius: 18 }} />
        </div>
        {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 68, borderRadius: 18 }} />)}
      </div>
    </div>
  )

  return (
    <div className="page fade-in">
      <div className="page-header">
        <h2>Pagos</h2>
        {editingAmount ? (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input className="input" type="number" value={amount} style={{ width: 80, padding: '8px 12px' }}
              onChange={e => setAmount(Number(e.target.value))} />
            <button className="btn btn-primary btn-sm" onClick={() => { localStorage.setItem('ns_payment_amount', amount); setEditingAmount(false); load() }}>OK</button>
          </div>
        ) : (
          <button className="btn btn-secondary btn-sm" onClick={() => setEditingAmount(true)}>
            Cuota: <strong>{amount}€</strong>
          </button>
        )}
      </div>

      <div className="page-content">
        {/* Month selector */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <button onClick={prevMonth} style={{ padding: '16px 20px', background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: 'var(--text-muted)' }}>‹</button>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 22, textTransform: 'uppercase', letterSpacing: '1px' }}>{MONTHS[month-1]}</div>
              <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>{year}</div>
            </div>
            <button onClick={nextMonth} style={{ padding: '16px 20px', background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: 'var(--text-muted)' }}>›</button>
          </div>

          {/* Progress bar */}
          <div style={{ padding: '0 16px 16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Cobrado</span>
              <span style={{ fontSize: 13, fontWeight: 800, color: pct === 100 ? 'var(--success)' : 'var(--accent)', fontFamily: "'Barlow Condensed', sans-serif" }}>{paid * amount}€ · {pct}%</span>
            </div>
            <div style={{ height: 8, background: 'var(--border)', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${pct}%`, background: pct === 100 ? 'var(--success)' : 'var(--accent-gradient)', borderRadius: 4, transition: 'width 0.5s ease' }} />
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid-2">
          <div className="stat-card" style={{ borderLeft: `3px solid var(--error)` }}>
            <div className="stat-value" style={{ color: 'var(--error)' }}>{pending.length}</div>
            <div className="stat-label">Pendientes</div>
          </div>
          <div className="stat-card" style={{ borderLeft: `3px solid var(--success)` }}>
            <div className="stat-value" style={{ color: 'var(--success)' }}>{paid}</div>
            <div className="stat-label">Pagados</div>
          </div>
        </div>

        {/* Pendientes */}
        {pending.length > 0 && (
          <>
            <div className="section-title">Pendientes</div>
            <div className="card">
              {pending.map((p, i) => {
                const a = getAthlete(p.athlete_id)
                const isToggling = toggling === p.id
                return (
                  <div key={p.id} className="list-item" style={{ borderBottom: i < pending.length-1 ? undefined : 'none' }}
                    onClick={() => !isToggling && toggle(p.id, p.status)}>
                    {a?.avatar_url
                      ? <img src={a.avatar_url} style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                      : <div className="avatar" style={{ background: a?.color+'20', color: a?.color }}>{initials(a?.name)}</div>
                    }
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{a?.name || 'Desconocido'}</div>
                      <div style={{ fontSize: 12, color: 'var(--error)', fontWeight: 600 }}>{p.amount}€ pendiente</div>
                    </div>
                    <div style={{ width: 32, height: 32, border: `2px solid var(--border)`, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.2s', background: isToggling ? 'var(--border)' : 'transparent' }}>
                      {isToggling && <span style={{ fontSize: 14 }}>⏳</span>}
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}

        {/* Pagados */}
        {paidList.length > 0 && (
          <>
            <div className="section-title" style={{ marginTop: 8 }}>Pagados</div>
            <div className="card">
              {paidList.map((p, i) => {
                const a = getAthlete(p.athlete_id)
                const isToggling = toggling === p.id
                return (
                  <div key={p.id} className="list-item" style={{ borderBottom: i < paidList.length-1 ? undefined : 'none', opacity: 0.75 }}
                    onClick={() => !isToggling && toggle(p.id, p.status)}>
                    {a?.avatar_url
                      ? <img src={a.avatar_url} style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                      : <div className="avatar" style={{ background: a?.color+'20', color: a?.color }}>{initials(a?.name)}</div>
                    }
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{a?.name || 'Desconocido'}</div>
                      <div style={{ fontSize: 12, color: 'var(--success)', fontWeight: 600 }}>✓ {p.amount}€ cobrado</div>
                    </div>
                    <div style={{ width: 32, height: 32, background: isToggling ? 'var(--border)' : 'var(--success)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.2s' }}>
                      {isToggling ? <span style={{ fontSize: 14 }}>⏳</span> : <span style={{ color: '#fff', fontSize: 16, fontWeight: 800 }}>✓</span>}
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}

        {pct === 100 && total > 0 && (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>🎉</div>
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 18, textTransform: 'uppercase', color: 'var(--success)' }}>¡Todo cobrado!</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>Todos los pagos de {MONTHS[month-1]} están al día</div>
          </div>
        )}
      </div>
    </div>
  )
}
