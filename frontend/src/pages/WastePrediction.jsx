import { useEffect, useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
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
import PageHeader from '../components/PageHeader'
import StatCard from '../components/StatCard'
import {
  fetchEvents,
  fetchPredictionMeasures,
  fetchPredictions,
  generatePrediction,
} from '../api'
import {
  baselineRates,
  defaultMeasures,
  predictionFactors,
  wasteCategories,
} from '../data/sampleData'

const MAX_REDUCTION_CAP = 0.9

function calculateEffectiveDuration(hours) {
  if (hours <= 0) return 0
  if (hours <= 4) return hours
  return 4 + (hours - 4) * 0.75
}

function calculateLocalForecast(type, attendees, hours, selectedMeasures, measuresList) {
  const rates = baselineRates[type] || baselineRates.Campus
  const effectiveHours = calculateEffectiveDuration(hours)
  const numAttendees = Math.max(0, Number(attendees) || 0)

  const unmitigated = {}
  const predicted = {}
  const avoided = {}
  const traces = {}

  wasteCategories.forEach((cat) => {
    const rate = rates[cat.id] || 0.01
    const baseKg = numAttendees * effectiveHours * rate

    // Calculate multiplicative retention
    let remaining = 1.0
    const catTraces = []
    selectedMeasures.forEach((measureId) => {
      const measure = measuresList.find((m) => m.id === measureId)
      if (measure?.reductions?.[cat.id]) {
        const discount = measure.reductions[cat.id]
        remaining *= 1.0 - discount
        catTraces.push({
          measureName: measure.name,
          discountPct: Math.round(discount * 100),
        })
      }
    })

    const finalRetention = Math.max(1.0 - MAX_REDUCTION_CAP, remaining)
    const predictedKg = baseKg * finalRetention
    const avoidedKg = baseKg - predictedKg

    unmitigated[cat.id] = Number(baseKg.toFixed(2))
    predicted[cat.id] = Number(predictedKg.toFixed(2))
    avoided[cat.id] = Number(avoidedKg.toFixed(2))
    traces[cat.id] = catTraces
  })

  const unmitigatedTotal = Number(
    Object.values(unmitigated).reduce((a, b) => a + b, 0).toFixed(2),
  )
  const predictedTotal = Number(
    Object.values(predicted).reduce((a, b) => a + b, 0).toFixed(2),
  )
  const avoidedTotal = Number(
    Math.max(0, unmitigatedTotal - predictedTotal).toFixed(2),
  )
  const avoidanceRatePct =
    unmitigatedTotal > 0
      ? Number(((avoidedTotal / unmitigatedTotal) * 100).toFixed(1))
      : 0

  return {
    effectiveHours: Number(effectiveHours.toFixed(2)),
    unmitigated,
    predicted,
    avoided,
    unmitigatedTotal,
    predictedTotal,
    avoidedTotal,
    avoidanceRatePct,
    traces,
  }
}

function WastePrediction() {
  const [type, setType] = useState('Technical')
  const [attendees, setAttendees] = useState(500)
  const [hours, setHours] = useState(6)
  const [selectedMeasures, setSelectedMeasures] = useState([
    'reusable_cutlery',
    'water_refill_stations',
    'digital_ticketing_materials',
  ])
  const [availableMeasures, setAvailableMeasures] = useState(defaultMeasures)
  const [eventsList, setEventsList] = useState([])
  const [selectedEventId, setSelectedEventId] = useState('')
  const [savedPredictions, setSavedPredictions] = useState([])
  const [activeTab, setActiveTab] = useState('charts') // 'charts' | 'assumptions' | 'history'

  const [saving, setSaving] = useState(false)
  const [saveSuccessMsg, setSaveSuccessMsg] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  // Fetch registered measures, events, and prediction history
  useEffect(() => {
    fetchPredictionMeasures()
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setAvailableMeasures(data)
        }
      })
      .catch(() => {})

    fetchEvents()
      .then((data) => {
        if (Array.isArray(data)) {
          setEventsList(data)
        }
      })
      .catch(() => {})

    loadSavedPredictions()
  }, [])

  function loadSavedPredictions() {
    fetchPredictions()
      .then((data) => {
        if (Array.isArray(data)) {
          setSavedPredictions(data)
        }
      })
      .catch(() => {})
  }

  // Handle event selection auto-populating attendees and type
  function handleEventSelect(e) {
    const eventId = e.target.value
    setSelectedEventId(eventId)
    if (!eventId) return

    const ev = eventsList.find((item) => String(item.id) === String(eventId))
    if (ev) {
      if (ev.category && baselineRates[ev.category]) {
        setType(ev.category)
      }
      if (ev.attendees && ev.attendees > 0) {
        setAttendees(ev.attendees)
      }
    }
  }

  // Toggle reduction measure checkbox
  function toggleMeasure(measureId) {
    setSelectedMeasures((prev) =>
      prev.includes(measureId)
        ? prev.filter((id) => id !== measureId)
        : [...prev, measureId],
    )
  }

  // Real-time calculation
  const forecast = useMemo(
    () =>
      calculateLocalForecast(
        type,
        attendees,
        hours,
        selectedMeasures,
        availableMeasures,
      ),
    [type, attendees, hours, selectedMeasures, availableMeasures],
  )

  // Chart data: Baseline vs Predicted with Measures for all 5 categories
  const barChartData = useMemo(() => {
    return wasteCategories.map((cat) => ({
      name: cat.name,
      'Baseline (kg)': forecast.unmitigated[cat.id] || 0,
      'Predicted (kg)': forecast.predicted[cat.id] || 0,
      'Avoided (kg)': forecast.avoided[cat.id] || 0,
      color: cat.color,
    }))
  }, [forecast])

  // Donut chart data for the 5 categories
  const pieChartData = useMemo(() => {
    return wasteCategories
      .map((cat) => ({
        name: cat.name,
        value: forecast.predicted[cat.id] || 0,
        color: cat.color,
      }))
      .filter((item) => item.value > 0)
  }, [forecast])

  // Save prediction to SQLite database via backend API
  async function handleSavePrediction() {
    setSaving(true)
    setSaveSuccessMsg('')
    setErrorMessage('')

    const numAttendees = Number(attendees)
    const numHours = Number(hours)

    if (isNaN(numAttendees) || numAttendees < 0) {
      setErrorMessage('Expected attendees must be 0 or more.')
      setSaving(false)
      return
    }
    if (isNaN(numHours) || numHours <= 0 || numHours > 24) {
      setErrorMessage('Event duration must be between 0.5 and 24 hours.')
      setSaving(false)
      return
    }

    try {
      const payload = {
        event_type: type,
        attendees: numAttendees,
        duration_hours: numHours,
        planned_measures: selectedMeasures,
        event_id: selectedEventId ? Number(selectedEventId) : null,
      }

      await generatePrediction(payload, selectedEventId ? Number(selectedEventId) : null)
      setSaveSuccessMsg('Forecast saved to SQLite database!')
      loadSavedPredictions()
      setTimeout(() => setSaveSuccessMsg(''), 4500)
    } catch (err) {
      setErrorMessage(err.message || 'Failed to save prediction.')
    } finally {
      setSaving(false)
    }
  }

  // Load a saved prediction back into the form
  function loadPredictionIntoForm(pred) {
    if (pred.event_type && baselineRates[pred.event_type]) {
      setType(pred.event_type)
    }
    if (pred.attendees) {
      setAttendees(pred.attendees)
    }
    if (pred.duration_hours) {
      setHours(pred.duration_hours)
    }
    if (Array.isArray(pred.reduction_measures)) {
      setSelectedMeasures(pred.reduction_measures)
    }
    if (pred.event_id) {
      setSelectedEventId(String(pred.event_id))
    } else {
      setSelectedEventId('')
    }
    setActiveTab('charts')
  }

  return (
    <div className="page">
      <PageHeader
        eyebrow="Sustainable Event Planning"
        title="Waste Prediction & Mitigation Engine"
        subtitle="Rule-based waste forecasting across Organic, Plastic, Paper, Electronic, and Other streams with documented assumptions."
      />

      {/* Prominent Disclaimer Banner */}
      <section className="prediction-alert-banner" role="alert">
        <span className="alert-icon" aria-hidden="true">⚠️</span>
        <div>
          <h2 className="alert-title">Planning Estimate Disclaimer</h2>
          <p className="alert-desc">
            All figures shown in this module are mathematical <strong>planning estimates</strong> calculated from campus empirical baseline rates and mitigation percentages. They are <strong>NOT actual certified scale measurements</strong>. Use them to budget bins, order supplies, and assess reduction targets before the event.
          </p>
        </div>
      </section>

      <div className="split">
        {/* Left Column: Interactive Inputs */}
        <form className="panel form" onSubmit={(e) => e.preventDefault()}>
          <h2>Event Parameters</h2>

          {/* Optional Event Linking */}
          <label>
            Link to Scheduled Campus Event (Optional)
            <select value={selectedEventId} onChange={handleEventSelect}>
              <option value="">-- Standalone / Custom Calculation --</option>
              {eventsList.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.name} ({ev.category}, {ev.attendees} attendees)
                </option>
              ))}
            </select>
          </label>

          {/* Event Category / Type */}
          <label>
            Event Category
            <select value={type} onChange={(e) => setType(e.target.value)}>
              {predictionFactors.map((item) => (
                <option key={item.type} value={item.type}>
                  {item.type} Event
                </option>
              ))}
            </select>
          </label>

          {/* Attendees with quick preset pills */}
          <label>
            Expected Attendees
            <input
              type="number"
              min="0"
              max="50000"
              value={attendees}
              onChange={(e) => setAttendees(e.target.value)}
            />
            <div className="preset-pills">
              {[50, 150, 350, 500, 1000].map((preset) => (
                <button
                  type="button"
                  key={preset}
                  className={`pill-btn ${Number(attendees) === preset ? 'active' : ''}`}
                  onClick={() => setAttendees(preset)}
                >
                  {preset} pax
                </button>
              ))}
            </div>
          </label>

          {/* Duration with quick preset pills */}
          <label>
            Event Duration (Hours)
            <input
              type="number"
              min="0.5"
              max="24"
              step="0.5"
              value={hours}
              onChange={(e) => setHours(e.target.value)}
            />
            <div className="preset-pills">
              {[2, 4, 6, 8, 12].map((preset) => (
                <button
                  type="button"
                  key={preset}
                  className={`pill-btn ${Number(hours) === preset ? 'active' : ''}`}
                  onClick={() => setHours(preset)}
                >
                  {preset} hrs
                </button>
              ))}
            </div>
          </label>

          {/* Planned Waste-Reduction Measures */}
          <div style={{ marginTop: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <strong style={{ fontSize: '0.95rem' }}>Planned Waste-Reduction Measures</strong>
              <span className="badge" style={{ fontSize: '0.72rem' }}>
                {selectedMeasures.length} Selected
              </span>
            </div>
            <p className="hint" style={{ fontSize: '0.8rem', margin: '0 0 10px' }}>
              Select all sustainable measures your organizing committee commits to implementing:
            </p>

            <div className="measure-grid">
              {availableMeasures.map((measure) => {
                const isSelected = selectedMeasures.includes(measure.id)
                return (
                  <label
                    key={measure.id}
                    className={`measure-card ${isSelected ? 'selected' : ''}`}
                    onClick={() => toggleMeasure(measure.id)}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {}} // handled by card onClick
                      onClick={(e) => e.stopPropagation()}
                    />
                    <div className="measure-content">
                      <div className="measure-header">
                        <span className="measure-name">{measure.name}</span>
                        <span className="measure-tag">{measure.target_stream}</span>
                      </div>
                      <p className="measure-desc">{measure.description}</p>
                    </div>
                  </label>
                )
              })}
            </div>
          </div>

          {/* Action buttons */}
          <div className="btn-group">
            <button
              type="button"
              onClick={handleSavePrediction}
              disabled={saving}
              style={{ flex: 1 }}
            >
              {saving ? 'Saving to Database...' : '💾 Save Prediction to SQLite'}
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                setSelectedMeasures([])
                setAttendees(300)
                setHours(4)
                setSelectedEventId('')
              }}
            >
              Reset
            </button>
          </div>

          {saveSuccessMsg && <p className="success">✓ {saveSuccessMsg}</p>}
          {errorMessage && <p className="form-error">⚠ {errorMessage}</p>}
        </form>

        {/* Right Column: Prediction Breakdown & Analytics */}
        <div>
          {/* Top Metric Cards */}
          <section className="stat-grid three">
            <StatCard
              label="Estimated Total Waste"
              value={`${forecast.predictedTotal} kg`}
              hint={
                <span>
                  <span className="badge-estimate">ESTIMATE</span>{' '}
                  {type} ({attendees} pax, {hours}h)
                </span>
              }
            />
            <StatCard
              label="Waste Prevented / Avoided"
              value={`${forecast.avoidedTotal} kg`}
              hint={`-${forecast.avoidanceRatePct}% from planned measures`}
            />
            <StatCard
              label="Unmitigated Baseline"
              value={`${forecast.unmitigatedTotal} kg`}
              hint="If no reduction measures taken"
            />
          </section>

          {/* 5-Category Breakdown Cards */}
          <div className="category-cards-grid">
            {wasteCategories.map((cat) => {
              const kg = forecast.predicted[cat.id] || 0
              const avoidedKg = forecast.avoided[cat.id] || 0
              const unmitigatedKg = forecast.unmitigated[cat.id] || 0
              const pctOfTotal =
                forecast.predictedTotal > 0
                  ? Math.round((kg / forecast.predictedTotal) * 100)
                  : 0

              return (
                <div key={cat.id} className="category-card" style={{ borderLeft: `4px solid ${cat.color}` }}>
                  <div className="category-card-top">
                    <span className="category-card-name">
                      <span>{cat.icon}</span> {cat.name}
                    </span>
                    <span
                      className="category-card-pct"
                      style={{ background: cat.bg, color: cat.color }}
                    >
                      {pctOfTotal}%
                    </span>
                  </div>
                  <div className="category-card-kg">{kg} kg</div>
                  <div className="category-card-unmitigated">
                    Baseline: {unmitigatedKg} kg
                  </div>
                  {avoidedKg > 0 ? (
                    <div className="category-card-avoided">
                      ↓ Saved {avoidedKg} kg
                    </div>
                  ) : (
                    <div className="hint" style={{ fontSize: '0.74rem' }}>
                      No measures applied
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Deep-Dive Tabs */}
          <div className="tabs-nav">
            <button
              type="button"
              className={`tab-btn ${activeTab === 'charts' ? 'active' : ''}`}
              onClick={() => setActiveTab('charts')}
            >
              📊 Visual Charts
            </button>
            <button
              type="button"
              className={`tab-btn ${activeTab === 'assumptions' ? 'active' : ''}`}
              onClick={() => setActiveTab('assumptions')}
            >
              📐 Formula & Assumptions
            </button>
            <button
              type="button"
              className={`tab-btn ${activeTab === 'history' ? 'active' : ''}`}
              onClick={() => setActiveTab('history')}
            >
              🕒 Saved Predictions ({savedPredictions.length})
            </button>
          </div>

          {/* TAB 1: Visual Charts */}
          {activeTab === 'charts' && (
            <article className="panel">
              <h2>Category Breakdown & Mitigation Impact</h2>
              <p className="hint">
                Comparing unmitigated baseline generation vs. net estimated waste with planned reduction measures:
              </p>
              <div className="chart-box" style={{ marginTop: '12px' }}>
                <ResponsiveContainer width="100%" height={290}>
                  <BarChart data={barChartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="name" />
                    <YAxis unit="kg" />
                    <Tooltip
                      formatter={(val, name) => [`${val} kg`, name]}
                      contentStyle={{ borderRadius: '8px', border: '1px solid #cbd5e1' }}
                    />
                    <Legend />
                    <Bar dataKey="Baseline (kg)" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Predicted (kg)" fill="#0f766e" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {pieChartData.length > 0 && (
                <div style={{ marginTop: '20px', borderTop: '1px solid var(--line)', paddingTop: '16px' }}>
                  <h3 style={{ fontSize: '0.98rem' }}>Predicted Category Distribution</h3>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200 }}>
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie
                          data={pieChartData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          outerRadius={75}
                          innerRadius={45}
                          paddingAngle={3}
                          label={(entry) => `${entry.name}: ${entry.value}kg`}
                        >
                          {pieChartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(val) => [`${val} kg`, 'Estimated']} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </article>
          )}

          {/* TAB 2: Formula & Assumptions */}
          {activeTab === 'assumptions' && (
            <article className="panel assumptions-box">
              <h4>Transparent Rule-Based Formula & Assumptions</h4>
              <p>
                Our estimation model calculates waste through empirical campus generation rates and documented diminishing-returns mitigation:
              </p>

              <div className="formula-display">
                <strong>1. Effective Duration Scaling:</strong>
                <br />
                {hours} hours → <code>{forecast.effectiveHours} effective hours</code>
                <br />
                <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
                  (First 4 hours at 100% baseline consumption; subsequent hours at 75% intensity)
                </span>
              </div>

              <div className="formula-display">
                <strong>2. Baseline Category Generation:</strong>
                <br />
                <code>Baseline_kg[c] = Attendees × Effective_Hours × Rate[c]</code>
              </div>

              <div className="formula-display">
                <strong>3. Mitigation Retention with Diminishing Returns:</strong>
                <br />
                <code>Retention[c] = max(0.10, Π (1 - Discount_i))</code>
                <br />
                <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
                  (Guarantees at least 10% unavoidable residual waste; stacking multiple measures compounds discounts)
                </span>
              </div>

              <h4 style={{ marginTop: '16px' }}>Baseline Rates for {type} Events</h4>
              <div className="table-wrap">
                <table className="rates-table">
                  <thead>
                    <tr>
                      <th>Stream</th>
                      <th>Rate (kg / person-hr)</th>
                      <th>Expected for {attendees} attendees</th>
                      <th>Mitigation Discounts Applied</th>
                    </tr>
                  </thead>
                  <tbody>
                    {wasteCategories.map((cat) => {
                      const rate = baselineRates[type]?.[cat.id] || 0.01
                      const tr = forecast.traces[cat.id] || []
                      return (
                        <tr key={cat.id}>
                          <td>
                            <strong>{cat.icon} {cat.name}</strong>
                          </td>
                          <td>{rate} kg/pax-hr</td>
                          <td>{forecast.unmitigated[cat.id]} kg</td>
                          <td>
                            {tr.length > 0 ? (
                              tr.map((t, idx) => (
                                <span key={idx} className="saved-pill">
                                  {t.measureName} (-{t.discountPct}%)
                                </span>
                              ))
                            ) : (
                              <span className="hint">No measures selected</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </article>
          )}

          {/* TAB 3: Saved Predictions in SQLite */}
          {activeTab === 'history' && (
            <article className="panel">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <h2>Predictions Stored in SQLite</h2>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={loadSavedPredictions}
                  style={{ padding: '6px 12px', fontSize: '0.82rem' }}
                >
                  🔄 Refresh
                </button>
              </div>

              {savedPredictions.length === 0 ? (
                <p className="hint">No predictions saved yet. Click "Save Prediction to SQLite" to store your first forecast.</p>
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Date & Event</th>
                        <th>Attendees / Duration</th>
                        <th>Measures</th>
                        <th>Breakdown (kg)</th>
                        <th>Total</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {savedPredictions.map((pred) => (
                        <tr key={pred.id}>
                          <td>
                            <strong>{pred.event_name || `${pred.event_type} Event`}</strong>
                            <div className="hint" style={{ fontSize: '0.75rem' }}>
                              {pred.created_at?.slice(0, 16) || 'Demo'}
                            </div>
                          </td>
                          <td>
                            {pred.attendees} pax
                            <div className="hint" style={{ fontSize: '0.75rem' }}>
                              {pred.duration_hours} hrs
                            </div>
                          </td>
                          <td>
                            {Array.isArray(pred.reduction_measures) && pred.reduction_measures.length > 0 ? (
                              pred.reduction_measures.map((mId) => (
                                <span key={mId} className="saved-pill">
                                  {availableMeasures.find((m) => m.id === mId)?.name?.split(' ')[0] || mId}
                                </span>
                              ))
                            ) : (
                              <span className="hint">None</span>
                            )}
                          </td>
                          <td style={{ fontSize: '0.8rem' }}>
                            🌱 {pred.predicted_organic_kg ?? pred.category_breakdown?.organic ?? '-'} |{' '}
                            🥤 {pred.predicted_plastic_kg ?? pred.category_breakdown?.plastic ?? '-'} |{' '}
                            📄 {pred.predicted_paper_kg ?? pred.category_breakdown?.paper ?? '-'} |{' '}
                            🔌 {pred.predicted_electronic_kg ?? pred.category_breakdown?.electronic ?? '-'} |{' '}
                            🗑️ {pred.predicted_other_kg ?? pred.category_breakdown?.other ?? '-'}
                          </td>
                          <td>
                            <strong>{pred.predicted_total_kg} kg</strong>
                          </td>
                          <td>
                            <button
                              type="button"
                              className="btn-secondary"
                              style={{ padding: '4px 8px', fontSize: '0.78rem' }}
                              onClick={() => loadPredictionIntoForm(pred)}
                            >
                              Load
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </article>
          )}
        </div>
      </div>
    </div>
  )
}

export default WastePrediction
