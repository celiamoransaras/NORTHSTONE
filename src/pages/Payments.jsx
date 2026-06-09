import { useState, useEffect } from 'react'
import { Payments as DB, Athletes } from '../lib/db'
import { supabase } from '../lib/supabase'
import { useToast } from '../contexts/ToastContext'
import { haptic } from '../lib/haptic'

const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

function AnnualSummary({ year, athletes }) {
  const [data, setData] = useState(null)

  useEffect(() => {
    const load = async () => {
      let totalPaid = 0, totalPending = 0
      const byAthlete = {}
      athletes.forEach(a => { byAthlete[a.id] = { name: a.name, color: a.color, paid: 0, pending: 0 } })

      for (let m = 1; m <= 12; m++) {
        const pays = await DB.getByMonth(m, year)
        pays.forEach(p => {
          if (!byAthlete[p.athlete_id]) return
          if (p.status === 'paid') { byAthlete[p.athlete_id].paid++; totalPaid += p.amount }
          else { byAthlete[p.athlete_id].pending++; totalPending += p.amount }
        })
      }
      setData({ totalPaid, totalPending, byAthlete: Object.values(byAthlete) })
    }
    if (athletes.length) load()
  }, [year, athletes])

  if (!data) return <div style={{ textAlign: 'center', padding: 16, color: 'var(--text-muted)', fontSize: 13 }}>Cargando resumen...</div>

  const initials = (name) => name?.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase() || '?'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="grid-2">
        <div className="stat-card" style={{ borderLeft: '3px solid var(--success)' }}>
          <div className="stat-value" style={{ color: 'var(--success)' }}>{data.totalPaid}€</div>
          <div className="stat-label">Cobrado en {year}</div>
        </div>
        <div className="stat-card" style={{ borderLeft: '3px solid var(--error)' }}>
          <div className="stat-value" style={{ color: 'var(--error)' }}>{data.totalPending}€</div>
          <div className="stat-label">Pendiente en {year}</div>
        </div>
      </div>
      <div className="card">
        {data.byAthlete.filter(a => a.paid > 0 || a.pending > 0).map((a, i, arr) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none' }}>
            <div className="avatar" style={{ background: a.color + '20', color: a.color, width: 36, height: 36, fontSize: 13, flexShrink: 0 }}>{initials(a.name)}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{a.name}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{a.paid} meses pagados · {a.pending} pendientes</div>
            </div>
            <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--success)' }}>{a.paid > 0 ? `${a.paid * (a.paid > 0 ? Math.round(data.totalPaid / a.paid / a.paid * a.paid) : 0)}€` : '—'}</div>
          </div>
        ))}
        {data.byAthlete.every(a => a.paid === 0 && a.pending === 0) && (
          <div style={{ textAlign: 'center', padding: 16, color: 'var(--text-muted)', fontSize: 13 }}>Sin datos en {year}</div>
        )}
      </div>
    </div>
  )
}

export default function Payments() {
  const [payments, setPayments] = useState([])
  const [athletes, setAthletes] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAnnual, setShowAnnual] = useState(false)
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())
  const [toggling, setToggling] = useState(null)
  // Per-athlete fees: { [athleteId]: number }
  const [fees, setFees] = useState({})
  const [editingFee, setEditingFee] = useState(null) // athleteId being edited
  const [feeInput, setFeeInput] = useState('')
  const toast = useToast()

  const load = async () => {
    setLoading(true)
    const ath = await Athletes.getAll()
    setAthletes(ath)
    const f = {}
    ath.forEach(a => { if (a.monthly_fee != null) f[a.id] = a.monthly_fee })
    setFees(f)
    const pays = await DB.ensureMonth(ath, month, year)
    setPayments(pays)
    setLoading(false)
  }

  useEffect(() => { load() }, [month, year])

  const saveFee = async (athleteId) => {
    const val = Number(feeInput)
    if (isNaN(val) || val < 0 || feeInput === '') { toast('Introduce un importe válido (0 o mayor)', 'error'); return }
    await supabase.from('athletes').update({ monthly_fee: val }).eq('id', athleteId)
    setFees(prev => ({ ...prev, [athleteId]: val }))
    setEditingFee(null)
    setFeeInput('')
    haptic('success')
    toast('Cuota guardada ✓')
    // Reload to create payment record if it didn't exist
    const ath = await Athletes.getAll()
    const pays = await DB.ensureMonth(ath, month, year)
    setPayments(pays)
  }

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
  const totalCobrado = paidList.reduce((s, p) => s + p.amount, 0)

  // Athletes without fee assigned
  const noFeeAthletes = athletes.filter(a => !fees[a.id])

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
      </div>

      <div className="page-content">

        {/* Aviso si hay deportistas sin cuota */}
        {noFeeAthletes.length > 0 && (
          <div style={{ borderRadius: 16, background: 'rgba(217,119,6,0.08)', border: '1.5px solid rgba(217,119,6,0.3)', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', background: 'rgba(217,119,6,0.12)', borderBottom: '1px solid rgba(217,119,6,0.15)' }}>
              <span style={{ fontSize: 18 }}>⚠️</span>
              <div>
                <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 14, textTransform: 'uppercase', color: '#b45309', letterSpacing: '0.3px' }}>
                  {noFeeAthletes.length === 1 ? '1 deportista sin cuota asignada' : `${noFeeAthletes.length} deportistas sin cuota asignada`}
                </div>
                <div style={{ fontSize: 11, color: '#92400e', marginTop: 1 }}>Añade una cuota mensual para poder registrar pagos</div>
              </div>
            </div>
            <div style={{ padding: '4px 16px 8px' }}>
            {noFeeAthletes.map((a, i) => (
              <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: i < noFeeAthletes.length - 1 ? '1px solid rgba(217,119,6,0.12)' : 'none' }}>
                {a.avatar_url
                  ? <img src={a.avatar_url} style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                  : <div className="avatar" style={{ background: a.color+'20', color: a.color, width: 36, height: 36, fontSize: 13, flexShrink: 0 }}>{initials(a.name)}</div>
                }
                <div style={{ flex: 1, fontWeight: 700, fontSize: 14 }}>{a.name}</div>
                {editingFee === a.id ? (
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <input
                      className="input"
                      type="number"
                      value={feeInput}
                      onChange={e => setFeeInput(e.target.value)}
                      placeholder="€/mes"
                      min="0"
                      autoFocus
                      style={{ width: 80, padding: '6px 10px', fontSize: 14 }}
                    />
                    <button className="btn btn-primary btn-sm" onClick={() => saveFee(a.id)}>OK</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => { setEditingFee(null); setFeeInput('') }}>✕</button>
                  </div>
                ) : (
                  <button
                    className="btn btn-sm"
                    style={{ background: '#b45309', color: '#fff', border: 'none', fontWeight: 700 }}
                    onClick={() => { setEditingFee(a.id); setFeeInput('') }}>
                    + Añadir cuota
                  </button>
                )}
              </div>
            ))}
            </div>
          </div>
        )}

        {/* Cuotas asignadas */}
        {Object.keys(fees).length > 0 && (
          <div className="card">
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 13, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.5px', marginBottom: 10 }}>
              Cuotas mensuales
            </div>
            {athletes.filter(a => fees[a.id] != null).map((a, i, arr) => (
              <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none' }}>
                {a.avatar_url
                  ? <img src={a.avatar_url} style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                  : <div className="avatar" style={{ background: a.color+'20', color: a.color, width: 32, height: 32, fontSize: 12, flexShrink: 0 }}>{initials(a.name)}</div>
                }
                <div style={{ flex: 1, fontWeight: 600, fontSize: 14 }}>{a.name}</div>
                {editingFee === a.id ? (
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <input
                      className="input"
                      type="number"
                      value={feeInput}
                      onChange={e => setFeeInput(e.target.value)}
                      autoFocus
                      style={{ width: 80, padding: '6px 10px', fontSize: 14 }}
                    />
                    <button className="btn btn-primary btn-sm" onClick={() => saveFee(a.id)}>OK</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => { setEditingFee(null); setFeeInput('') }}>✕</button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontWeight: 800, fontSize: 15, color: 'var(--text)' }}>{fees[a.id]}€</span>
                    <button
                      style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, padding: 4, color: 'var(--text-muted)' }}
                      onClick={() => { setEditingFee(a.id); setFeeInput(String(fees[a.id])) }}>
                      ✏️
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

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

          {total > 0 && (
            <div style={{ padding: '0 16px 16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Cobrado</span>
                <span style={{ fontSize: 13, fontWeight: 800, color: pct === 100 ? 'var(--success)' : 'var(--accent)', fontFamily: "'Barlow Condensed', sans-serif" }}>{totalCobrado}€ · {pct}%</span>
              </div>
              <div style={{ height: 8, background: 'var(--border)', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${pct}%`, background: pct === 100 ? 'var(--success)' : 'var(--accent-gradient)', borderRadius: 4, transition: 'width 0.5s ease' }} />
              </div>
            </div>
          )}
        </div>

        {total > 0 && (
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
        )}

        {total === 0 && Object.keys(fees).length > 0 && (
          <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)', fontSize: 14 }}>
            Sin registros de pago en {MONTHS[month-1]} {year}
          </div>
        )}

        {total === 0 && Object.keys(fees).length === 0 && (
          <div style={{ textAlign: 'center', padding: '32px 16px' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>💶</div>
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 18, textTransform: 'uppercase', marginBottom: 8 }}>Añade las cuotas</div>
            <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>Asigna un importe mensual a cada deportista para empezar a gestionar los pagos</div>
          </div>
        )}

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

        {/* Resumen anual */}
        <div style={{ marginTop: 8 }}>
          <button onClick={() => setShowAnnual(s => !s)}
            style={{ width: '100%', background: 'none', border: '1.5px solid var(--border)', borderRadius: 'var(--radius)', padding: '12px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 15, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text)' }}>
              📊 Resumen anual {year}
            </span>
            <span style={{ color: 'var(--text-muted)', fontSize: 18 }}>{showAnnual ? '▲' : '▼'}</span>
          </button>
          {showAnnual && (
            <div style={{ marginTop: 12 }}>
              <AnnualSummary year={year} athletes={athletes} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
