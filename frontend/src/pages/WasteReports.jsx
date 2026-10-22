import { useEffect, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  createWasteReport,
  fetchEvents,
  fetchReports,
  fetchWasteReports,
} from '../api'
import DataBanner from '../components/DataBanner'
import PageHeader from '../components/PageHeader'
import { monthlyWaste as sampleMonthly, reports as sampleReports } from '../data/sampleData'

const emptyReportForm = {
  event_id: '',
  category: 'recyclable',
  amount_kg: '',
  reported_by: '',
  notes: '',
}

function WasteReports() {
  const [live, setLive] = useState(false)
  const [monthly, setMonthly] = useState(sampleMonthly)
  const [eventReports, setEventReports] = useState(sampleReports)
  const [rawLogs, setRawLogs] = useState([])
  const [eventsList, setEventsList] = useState([])

  const [form, setForm] = useState(emptyReportForm)
  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [logFilterStream, setLogFilterStream] = useState('all')

  async function loadData() {
    try {
      const [reportsData, logsData, eventsData] = await Promise.all([
        fetchReports(),
        fetchWasteReports(),
        fetchEvents(),
      ])

      setLive(true)
      if (reportsData.monthly && reportsData.monthly.length > 0) {
        setMonthly(reportsData.monthly)
      }
      if (reportsData.events) {
        setEventReports(reportsData.events)
      }
      if (Array.isArray(logsData)) {
        setRawLogs(logsData)
      }
      if (Array.isArray(eventsData)) {
        setEventsList(eventsData)
        if (!form.event_id && eventsData.length > 0) {
          setForm((prev) => ({ ...prev, event_id: String(eventsData[0].id) }))
        }
      }
    } catch {
      setLive(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setErrorMsg('')
    setSuccessMsg('')

    if (!form.event_id) {
      setErrorMsg('Please select an event.')
      return
    }

    const amount = Number(form.amount_kg)
    if (isNaN(amount) || amount <= 0) {
      setErrorMsg('Measured amount must be a number greater than 0 kg.')
      return
    }

    setSubmitting(true)

    try {
      const payload = {
        event_id: Number(form.event_id),
        category: form.category,
        amount_kg: amount,
        reported_by: form.reported_by.trim() || 'Campus Volunteer',
        notes: form.notes.trim(),
      }

      await createWasteReport(payload)
      const targetEvent = eventsList.find((ev) => String(ev.id) === String(form.event_id))
      setSuccessMsg(`Successfully logged ${amount} kg of ${form.category} waste for ${targetEvent?.name || 'event'}!`)
      setForm((prev) => ({ ...emptyReportForm, event_id: prev.event_id }))
      await loadData()
    } catch (err) {
      setErrorMsg(err.message || 'Failed to submit waste report.')
    } finally {
      setSubmitting(false)
    }
  }

  const filteredLogs = rawLogs.filter((log) => {
    if (logFilterStream === 'all') return true
    return log.category?.toLowerCase() === logFilterStream.toLowerCase()
  })

  return (
    <div className="page">
      <PageHeader
        eyebrow="Verification & Auditing"
        title="Actual Waste Reports"
        subtitle="Log certified scale weights and analyze monthly diversion metrics directly backed by SQLite."
      />
      <DataBanner
        live={live}
        message={live ? 'Reports and audit logs are synchronized with SQLite database.' : 'API offline — showing demo analytics.'}
      />

      {/* Submit Actual Waste Report Form */}
      <section className="panel form" style={{ marginBottom: '24px' }}>
        <h2>Submit Actual Waste Measurement</h2>
        <p className="hint">
          Enter verified weighed amounts recorded at campus waste segregation and weighing points.
        </p>

        {errorMsg && <p className="form-error">⚠ {errorMsg}</p>}
        {successMsg && <p className="success">✓ {successMsg}</p>}

        <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px', alignItems: 'end' }}>
          <label>
            Campus Event *
            <select
              value={form.event_id}
              onChange={(e) => setForm({ ...form, event_id: e.target.value })}
              required
            >
              <option value="">-- Select Event --</option>
              {eventsList.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.name} ({ev.category})
                </option>
              ))}
            </select>
          </label>

          <label>
            Waste Stream *
            <select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            >
              <option value="recyclable">♻️ Recyclable</option>
              <option value="compost">🌱 Compost</option>
              <option value="landfill">🗑️ Landfill</option>
            </select>
          </label>

          <label>
            Measured Amount (kg) *
            <input
              type="number"
              min="0.1"
              step="0.1"
              value={form.amount_kg}
              onChange={(e) => setForm({ ...form, amount_kg: e.target.value })}
              placeholder="e.g. 18.5"
              required
            />
          </label>

          <label>
            Reported By
            <input
              value={form.reported_by}
              onChange={(e) => setForm({ ...form, reported_by: e.target.value })}
              placeholder="e.g. NSS / Eco Club"
            />
          </label>

          <label style={{ gridColumn: 'span 2' }}>
            Verification Notes
            <input
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="e.g. Clean PET bottles weighed at Gate 2 collection point"
            />
          </label>

          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button type="submit" disabled={submitting} style={{ width: '100%', height: '42px' }}>
              {submitting ? 'Saving...' : '⚖️ Record Waste Log'}
            </button>
          </div>
        </form>
      </section>

      {/* Visual Charts: Monthly Breakdown & Trends */}
      <section className="split">
        <article className="panel">
          <h2>Monthly Waste by Stream (Real Database)</h2>
          <div className="chart-box">
            <ResponsiveContainer width="100%" height={290}>
              <BarChart data={monthly}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="month" />
                <YAxis unit="kg" />
                <Tooltip formatter={(val, name) => [`${val} kg`, name]} />
                <Legend />
                <Bar dataKey="recyclable" name="Recyclable" stackId="a" fill="#0f766e" radius={[0, 0, 0, 0]} />
                <Bar dataKey="compost" name="Compost" stackId="a" fill="#16a34a" radius={[0, 0, 0, 0]} />
                <Bar dataKey="landfill" name="Landfill" stackId="a" fill="#94a3b8" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className="panel">
          <h2>Stream Comparison Over Time</h2>
          <div className="chart-box">
            <ResponsiveContainer width="100%" height={290}>
              <LineChart data={monthly}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="month" />
                <YAxis unit="kg" />
                <Tooltip formatter={(val, name) => [`${val} kg`, name]} />
                <Legend />
                <Line type="monotone" dataKey="recyclable" name="Recyclable" stroke="#0f766e" strokeWidth={2.5} />
                <Line type="monotone" dataKey="compost" name="Compost" stroke="#16a34a" strokeWidth={2.5} />
                <Line type="monotone" dataKey="landfill" name="Landfill" stroke="#64748b" strokeWidth={2} strokeDasharray="4 4" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </article>
      </section>

      {/* Event-Wise Summary Table */}
      <article className="panel table-wrap" style={{ marginBottom: '24px' }}>
        <h2>Event-Wise Aggregated Waste</h2>
        <table>
          <thead>
            <tr>
              <th>Event</th>
              <th>Recyclable (kg)</th>
              <th>Compost (kg)</th>
              <th>Landfill (kg)</th>
              <th>Total Weighed</th>
              <th>Diversion Rate</th>
            </tr>
          </thead>
          <tbody>
            {eventReports.map((row) => {
              const rec = Number(row.recyclable || 0)
              const comp = Number(row.compost || 0)
              const land = Number(row.landfill || 0)
              const total = (rec + comp + land).toFixed(1)
              const divRate = total > 0 ? (((rec + comp) / total) * 100).toFixed(0) : '0'

              return (
                <tr key={row.event}>
                  <td><strong>{row.event}</strong></td>
                  <td>{rec} kg</td>
                  <td>{comp} kg</td>
                  <td>{land} kg</td>
                  <td><strong>{total} kg</strong></td>
                  <td>
                    <span className="badge" style={{ background: Number(divRate) >= 70 ? '#dcfce7' : '#fef3c7', color: Number(divRate) >= 70 ? '#166534' : '#854d0e' }}>
                      {divRate}% diverted
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </article>

      {/* Individual Log Entries Audit Trail */}
      <article className="panel table-wrap">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
          <h2 style={{ margin: 0 }}>Actual Waste Measurement Logs ({filteredLogs.length})</h2>

          <div style={{ display: 'flex', gap: '6px' }}>
            {['all', 'recyclable', 'compost', 'landfill'].map((stream) => (
              <button
                key={stream}
                type="button"
                className={`pill-btn ${logFilterStream === stream ? 'active' : ''}`}
                onClick={() => setLogFilterStream(stream)}
              >
                {stream === 'all' ? 'All' : stream.charAt(0).toUpperCase() + stream.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {filteredLogs.length === 0 ? (
          <p className="hint">No waste logs recorded for this filter.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Date / Time</th>
                <th>Event</th>
                <th>Stream</th>
                <th>Weighed Amount</th>
                <th>Reported By</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.map((log) => (
                <tr key={log.id}>
                  <td style={{ fontSize: '0.8rem', color: '#64748b' }}>
                    {log.created_at ? log.created_at.slice(0, 16) : 'Demo'}
                  </td>
                  <td><strong>{log.event_name || `Event #${log.event_id}`}</strong></td>
                  <td>
                    <span
                      className="badge"
                      style={{
                        background:
                          log.category === 'recyclable' ? '#ccfbf1' : log.category === 'compost' ? '#dcfce7' : '#f1f5f9',
                        color:
                          log.category === 'recyclable' ? '#0f766e' : log.category === 'compost' ? '#15803d' : '#475569',
                      }}
                    >
                      {log.category}
                    </span>
                  </td>
                  <td><strong>{Number(log.amount_kg).toFixed(1)} kg</strong></td>
                  <td style={{ fontSize: '0.85rem' }}>{log.reported_by || 'Volunteer'}</td>
                  <td style={{ fontSize: '0.82rem', color: '#64748b' }}>{log.notes || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </article>
    </div>
  )
}

export default WasteReports
