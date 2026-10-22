import { useEffect, useState } from 'react'
import PageHeader from '../components/PageHeader'
import {
  fetchPredictions,
  fetchRecommendations,
} from '../api'

const STREAM_CONFIG = {
  all: { label: 'All Streams', icon: '♻️', color: '#0f766e', bg: '#ccfbf1' },
  plastic: { label: 'Plastic', icon: '🥤', color: '#0284c7', bg: '#e0f2fe' },
  paper: { label: 'Paper', icon: '📄', color: '#d97706', bg: '#fef3c7' },
  organic: { label: 'Food / Organic', icon: '🌱', color: '#16a34a', bg: '#dcfce7' },
  electronic: { label: 'E-Waste', icon: '🔌', color: '#9333ea', bg: '#f3e8ff' },
  other: { label: 'Decor & Other', icon: '🎨', color: '#64748b', bg: '#f1f5f9' },
}

function EcoAlternatives() {
  const [recommendations, setRecommendations] = useState([])
  const [predictions, setPredictions] = useState([])
  const [selectedPredictionId, setSelectedPredictionId] = useState('')
  const [selectedStream, setSelectedStream] = useState('all')
  const [predictionContext, setPredictionContext] = useState(null)
  const [predictedBreakdown, setPredictedBreakdown] = useState(null)
  const [totalPredictedKg, setTotalPredictedKg] = useState(null)
  const [loading, setLoading] = useState(true)
  const [plannedIds, setPlannedIds] = useState(() => {
    try {
      const saved = localStorage.getItem('srit_planned_eco_swaps')
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })

  // Load predictions on mount
  useEffect(() => {
    fetchPredictions()
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setPredictions(data)
          // Default to the latest saved prediction
          setSelectedPredictionId(String(data[0].id))
        }
      })
      .catch(() => {})
  }, [])

  // Load recommendations whenever prediction or stream filter changes
  useEffect(() => {
    setLoading(true)
    const params = {}
    if (selectedPredictionId) {
      params.prediction_id = selectedPredictionId
    }
    if (selectedStream !== 'all') {
      params.waste_stream = selectedStream
    }

    fetchRecommendations(params)
      .then((res) => {
        setRecommendations(res.recommendations || [])
        setPredictionContext(res.prediction_context || null)
        setPredictedBreakdown(res.predicted_breakdown || null)
        setTotalPredictedKg(res.total_predicted_kg || null)
      })
      .catch((err) => {
        console.error('Error fetching recommendations:', err)
      })
      .finally(() => {
        setLoading(false)
      })
  }, [selectedPredictionId, selectedStream])

  function togglePlanned(practiceId) {
    setPlannedIds((prev) => {
      const next = prev.includes(practiceId)
        ? prev.filter((id) => id !== practiceId)
        : [...prev, practiceId]
      try {
        localStorage.setItem('srit_planned_eco_swaps', JSON.stringify(next))
      } catch {}
      return next
    })
  }

  function getStreamMeta(streamKey) {
    const key = (streamKey || 'other').toLowerCase()
    return STREAM_CONFIG[key] || STREAM_CONFIG.other
  }

  function getPriorityClass(priority) {
    if (!priority) return 'standard'
    const p = priority.toLowerCase()
    if (p.includes('high')) return 'high'
    if (p.includes('medium')) return 'medium'
    return 'standard'
  }

  return (
    <div className="page">
      <PageHeader
        eyebrow="Targeted Waste Mitigation"
        title="Eco-Friendly Alternatives"
        subtitle="Prioritized green swaps tailored directly to your event's predicted waste streams."
      />

      {/* Prediction Selection & Stream Filter Bar */}
      <section className="panel form" style={{ marginBottom: '20px', padding: '16px 20px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ flex: '1 1 300px' }}>
            <label style={{ margin: 0 }}>
              <span style={{ fontWeight: 600 }}>Tailor Alternatives to Saved Prediction:</span>
              <select
                value={selectedPredictionId}
                onChange={(e) => setSelectedPredictionId(e.target.value)}
                style={{ marginTop: '4px' }}
              >
                <option value="">-- All Campus Best Practices (Default) --</option>
                {predictions.map((p) => (
                  <option key={p.id} value={p.id}>
                    #{p.id} {p.event_name ? `${p.event_name} (${p.event_type})` : `${p.event_type} Event`} — {p.attendees} pax, {p.predicted_total_kg} kg estimated
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span className="badge" style={{ padding: '6px 12px' }}>
              ✓ {plannedIds.length} Swaps in Your Event Plan
            </span>
            {plannedIds.length > 0 && (
              <button
                type="button"
                className="btn-secondary"
                style={{ padding: '6px 10px', fontSize: '0.78rem' }}
                onClick={() => {
                  setPlannedIds([])
                  localStorage.removeItem('srit_planned_eco_swaps')
                }}
              >
                Clear Plan
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Prediction Context Banner (shows when a prediction is active) */}
      {predictionContext && predictedBreakdown && (
        <section className="prediction-source-banner">
          <div className="prediction-source-info">
            <h3>
              🎯 Tailored for: {predictionContext.event_name || `${predictionContext.event_type} Event`}
            </h3>
            <p>
              Expected <strong>{predictionContext.attendees} attendees</strong> over <strong>{predictionContext.duration_hours} hours</strong> · Total Forecast: <strong>{totalPredictedKg} kg</strong>
            </p>
          </div>

          {/* 5-Stream breakdown pills */}
          <div className="stream-pills">
            <span className="stream-pill" style={{ borderColor: '#86efac', background: '#f0fdf4', color: '#166534' }}>
              🌱 Organic: {predictedBreakdown.organic ?? 0} kg
            </span>
            <span className="stream-pill" style={{ borderColor: '#7dd3fc', background: '#f0f9ff', color: '#0369a1' }}>
              🥤 Plastic: {predictedBreakdown.plastic ?? 0} kg
            </span>
            <span className="stream-pill" style={{ borderColor: '#fde68a', background: '#fefce8', color: '#854d0e' }}>
              📄 Paper: {predictedBreakdown.paper ?? 0} kg
            </span>
            <span className="stream-pill" style={{ borderColor: '#d8b4fe', background: '#faf5ff', color: '#6b21a8' }}>
              🔌 E-Waste: {predictedBreakdown.electronic ?? 0} kg
            </span>
            <span className="stream-pill" style={{ borderColor: '#cbd5e1', background: '#f8fafc', color: '#334155' }}>
              🎨 Other: {predictedBreakdown.other ?? 0} kg
            </span>
          </div>
        </section>
      )}

      {/* Stream Tabs / Filter Pills */}
      <div className="eco-filter-bar">
        {Object.entries(STREAM_CONFIG).map(([key, config]) => (
          <button
            key={key}
            type="button"
            className={`eco-filter-btn ${selectedStream === key ? 'active' : ''}`}
            onClick={() => setSelectedStream(key)}
          >
            <span>{config.icon}</span>
            <span>{config.label}</span>
          </button>
        ))}
      </div>

      {/* Loading state */}
      {loading ? (
        <p className="hint">Loading recommendations from database...</p>
      ) : recommendations.length === 0 ? (
        <div className="panel" style={{ textAlign: 'center', padding: '36px 20px' }}>
          <p className="hint" style={{ fontSize: '1.05rem', margin: '0 0 10px' }}>
            No recommendations found for this stream filter.
          </p>
          <button type="button" className="btn-secondary" onClick={() => setSelectedStream('all')}>
            View All Alternatives
          </button>
        </div>
      ) : (
        /* Attractive Alternatives Cards Grid */
        <div className="card-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}>
          {recommendations.map((item) => {
            const streamMeta = getStreamMeta(item.wasteStream)
            const priorityClass = getPriorityClass(item.priority)
            const isPlanned = plannedIds.includes(item.id)

            return (
              <article
                className="alt-card"
                key={item.id}
                style={{ borderTop: `4px solid ${streamMeta.color}` }}
              >
                {/* Header: Stream Badge & Priority Tag */}
                <div className="alt-card-header">
                  <span
                    className="stream-badge"
                    style={{ background: streamMeta.bg, color: streamMeta.color }}
                  >
                    <span>{streamMeta.icon}</span>
                    <span>{item.wasteStream}</span>
                  </span>

                  {item.priority && (
                    <span className={`priority-pill ${priorityClass}`}>
                      {item.priority}
                    </span>
                  )}
                </div>

                {/* Card Title */}
                <h3 className="alt-card-title">{item.title}</h3>

                {/* Target Waste Callout if prediction linked */}
                {item.predictedStreamKg !== null && item.predictedStreamKg !== undefined && (
                  <div className="target-waste-callout">
                    <span>🎯</span>
                    <span>
                      {item.predictedStreamKg > 0
                        ? `Targets ${item.predictedStreamKg} kg predicted ${item.wasteStream} waste`
                        : `Proactive ${item.wasteStream} prevention`}
                    </span>
                  </div>
                )}

                {/* Direct Green Swap Comparison */}
                <div className="swap-comparison">
                  <div className="instead-box">
                    <span className="swap-label">❌ Instead of:</span>
                    <div>{item.insteadOf}</div>
                  </div>

                  <div className="use-box">
                    <span className="swap-label">✅ Switch to:</span>
                    <div>
                      <strong>{item.use}</strong>
                    </div>
                  </div>
                </div>

                {/* Factual Operational Impact (No invented numbers) */}
                <div className="alt-impact">{item.impact}</div>

                {/* Implementation Pro-Tip */}
                <div className="tip-box">
                  <strong>💡 Campus Tip:</strong> {item.tip}
                </div>

                {/* Card Footer: Add to Checklist Action */}
                <div className="alt-card-footer">
                  <span className="hint" style={{ fontSize: '0.74rem' }}>
                    {item.category} Event Practice
                  </span>
                  <button
                    type="button"
                    className={`btn-plan-toggle ${isPlanned ? 'planned' : ''}`}
                    onClick={() => togglePlanned(item.id)}
                  >
                    {isPlanned ? '✓ Added to Plan' : '+ Plan this Swap'}
                  </button>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default EcoAlternatives
