import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { fetchEvents, fetchPredictions, fetchReports, fetchSummary } from '../api'
import EventCard from '../components/EventCard'
import DataBanner from '../components/DataBanner'
import PageHeader from '../components/PageHeader'
import StatCard from '../components/StatCard'
import {
  diversionTrend,
  events as sampleEvents,
  stats as sampleStats,
  wasteShare as sampleShare,
} from '../data/sampleData'

function Dashboard() {
  const [live, setLive] = useState(false)
  const [stats, setStats] = useState(sampleStats)
  const [wasteShare, setWasteShare] = useState(sampleShare)
  const [upcoming, setUpcoming] = useState(
    sampleEvents.filter((event) => event.status !== 'Completed').slice(0, 3),
  )
  const [trend, setTrend] = useState(diversionTrend)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const [summary, events, reportData, predictionsData] = await Promise.all([
          fetchSummary(),
          fetchEvents(),
          fetchReports(),
          fetchPredictions(),
        ])
        if (cancelled) return

        const nextShare = [
          { name: 'Recyclable', value: Number(summary.recyclable) || 0, color: '#0f766e' },
          { name: 'Compost', value: Number(summary.compost) || 0, color: '#16a34a' },
          { name: 'Landfill', value: Number(summary.landfill) || 0, color: '#94a3b8' },
        ]

        const nextTrend =
          Array.isArray(reportData.monthly) && reportData.monthly.length > 0
            ? reportData.monthly.map((row) => {
                const total = Number(row.recyclable) + Number(row.compost) + Number(row.landfill)
                const diverted = Number(row.recyclable) + Number(row.compost)
                return {
                  month: row.month,
                  rate: total ? Number(((diverted / total) * 100).toFixed(1)) : 0,
                  totalKg: Number(total.toFixed(1)),
                }
              })
            : [{ month: 'Current', rate: summary.diversion_rate || 0, totalKg: summary.total_kg || 0 }]

        const predSum = Array.isArray(predictionsData)
          ? predictionsData.reduce((acc, p) => acc + (Number(p.predicted_total_kg) || 0), 0)
          : 0

        setLive(true)
        setStats([
          {
            id: 'events',
            label: 'Campus Events',
            value: String(summary.event_count || events.length),
            hint: 'Stored in SQLite database',
          },
          {
            id: 'waste',
            label: 'Actual Waste Logged',
            value: `${Number(summary.total_kg || 0).toFixed(1)} kg`,
            hint: 'Weighed across campus events',
          },
          {
            id: 'diverted',
            label: 'Landfill Diversion Rate',
            value: `${summary.diversion_rate || 0}%`,
            hint: `${Number(summary.diverted_kg || 0).toFixed(1)} kg recycled & composted`,
          },
          {
            id: 'predictions',
            label: 'Forecasted Waste',
            value: `${Number(predSum).toFixed(1)} kg`,
            hint: `${predictionsData.length || 0} event models in SQLite`,
          },
        ])
        setWasteShare(nextShare)
        setUpcoming(events.filter((event) => event.status !== 'Completed').slice(0, 3))
        setTrend(nextTrend)
      } catch {
        if (!cancelled) setLive(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="page">
      <PageHeader
        eyebrow="SRIT Campus Command Center"
        title="Zero Waste Event Tracking & Forecasting"
        subtitle="Real-time campus waste diversion metrics, event schedules, and material recovery analytics."
      />
      <DataBanner
        live={live}
        message={live ? 'Dashboard is synchronized with the live Flask / SQLite backend.' : 'API offline — displaying local demo data.'}
      />

      {/* Quick Action Navigation Bar */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '10px',
          marginBottom: '20px',
        }}
      >
        <Link to="/events" className="pill-btn" style={{ padding: '8px 14px', fontSize: '0.85rem' }}>
          📅 Manage Events
        </Link>
        <Link to="/prediction" className="pill-btn" style={{ padding: '8px 14px', fontSize: '0.85rem' }}>
          🔮 Waste Prediction Tool
        </Link>
        <Link to="/reports" className="pill-btn" style={{ padding: '8px 14px', fontSize: '0.85rem' }}>
          ⚖️ Actual Waste Reports
        </Link>
        <Link to="/alternatives" className="pill-btn" style={{ padding: '8px 14px', fontSize: '0.85rem' }}>
          🌿 Eco Alternatives
        </Link>
        <Link to="/feedback" className="pill-btn" style={{ padding: '8px 14px', fontSize: '0.85rem' }}>
          💬 Volunteer Feedback
        </Link>
      </div>

      {/* Real Statistics Grid */}
      <section className="stat-grid">
        {stats.map((item) => (
          <StatCard key={item.id} {...item} />
        ))}
      </section>

      {/* Real Application Charts */}
      <section className="split">
        <article className="panel">
          <h2>Actual Waste Mix (From Database Logs)</h2>
          <p className="hint">Breakdown of weighed campus waste by stream.</p>
          <div className="chart-box">
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={wasteShare}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={60}
                  outerRadius={95}
                  label={(entry) => `${entry.name}: ${entry.value}kg`}
                >
                  {wasteShare.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(val) => [`${val} kg`, 'Logged Amount']} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className="panel">
          <h2>Landfill Diversion Rate Trend (Monthly)</h2>
          <p className="hint">Percentage of waste diverted from landfill each month.</p>
          <div className="chart-box">
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="month" />
                <YAxis unit="%" domain={[0, 100]} />
                <Tooltip formatter={(val) => [`${val}%`, 'Diversion Rate']} />
                <Area type="monotone" dataKey="rate" stroke="#0f766e" fill="#99f6e4" strokeWidth={2.5} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </article>
      </section>

      {/* Live Upcoming Events */}
      <section>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <h2 className="section-title" style={{ margin: 0 }}>Active & Upcoming Campus Events</h2>
          <Link to="/events" className="btn-secondary" style={{ padding: '6px 12px', fontSize: '0.82rem' }}>
            View All Events →
          </Link>
        </div>

        {upcoming.length === 0 ? (
          <div className="panel" style={{ textAlign: 'center', padding: '24px' }}>
            <p className="hint">No upcoming events scheduled. Register one to start tracking!</p>
          </div>
        ) : (
          <div className="card-grid">
            {upcoming.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

export default Dashboard
