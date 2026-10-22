import { useEffect, useState } from 'react'
import { fetchEvents, fetchFeedback, submitFeedback } from '../api'
import DataBanner from '../components/DataBanner'
import PageHeader from '../components/PageHeader'

const emptyForm = {
  name: '',
  role: 'Student',
  event: '',
  rating: '5',
  message: '',
}

function Feedback() {
  const [form, setForm] = useState(emptyForm)
  const [sent, setSent] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [live, setLive] = useState(false)
  const [entries, setEntries] = useState([])
  const [eventsList, setEventsList] = useState([])

  async function loadData() {
    try {
      const [feedbackRows, eventsData] = await Promise.all([
        fetchFeedback(),
        fetchEvents(),
      ])
      setEntries(feedbackRows)
      setLive(true)
      if (Array.isArray(eventsData) && eventsData.length > 0) {
        setEventsList(eventsData)
        if (!form.event) {
          setForm((prev) => ({ ...prev, event: eventsData[0].name }))
        }
      }
    } catch {
      setLive(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setSent('')

    const trimmedName = form.name.trim()
    const trimmedEvent = form.event.trim()
    const trimmedMessage = form.message.trim()
    const ratingNum = Number(form.rating)

    if (!trimmedName) {
      setError('Please provide your name.')
      return
    }
    if (!trimmedEvent) {
      setError('Please select or specify the campus event.')
      return
    }
    if (!trimmedMessage) {
      setError('Please enter your feedback message.')
      return
    }
    if (isNaN(ratingNum) || ratingNum < 1 || ratingNum > 5) {
      setError('Rating must be between 1 and 5.')
      return
    }

    const payload = {
      name: trimmedName,
      role: form.role,
      event: trimmedEvent,
      rating: ratingNum,
      message: trimmedMessage,
    }

    setSubmitting(true)

    if (!live) {
      setEntries((current) => [
        {
          id: Date.now(),
          ...payload,
          created_at: new Date().toISOString().slice(0, 16).replace('T', ' '),
        },
        ...current,
      ])
      setSent('Feedback recorded in your local browser session.')
      setForm((prev) => ({ ...emptyForm, event: prev.event }))
      setSubmitting(false)
      return
    }

    try {
      await submitFeedback(payload)
      setSent('Thank you! Your feedback has been saved to the SQLite database.')
      setForm((prev) => ({ ...emptyForm, event: prev.event }))
      await loadData()
    } catch (err) {
      setError(err.message || 'Failed to submit feedback.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="page">
      <PageHeader
        eyebrow="Campus Community Voice"
        title="Event Feedback & Segregation Notes"
        subtitle="Submit volunteer observations and attendee ratings stored in the database."
      />
      <DataBanner
        live={live}
        message={live ? 'Feedback responses are recorded directly in the Flask SQLite database.' : 'API offline — feedback stays on this screen.'}
      />

      <div className="split">
        {/* Submit Feedback Form */}
        <form className="panel form" onSubmit={handleSubmit}>
          <h2>Share Your Feedback</h2>

          {sent && <p className="success">✓ {sent}</p>}
          {error && <p className="form-error">⚠ {error}</p>}

          <label>
            Your Name *
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Ananya Sharma"
              required
            />
          </label>

          <label>
            Your Campus Role *
            <select
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
            >
              <option value="Student">Student Attendee</option>
              <option value="Volunteer">Green Volunteer (NSS/Club)</option>
              <option value="Faculty">Faculty Coordinator</option>
              <option value="Event organiser">Event Organiser</option>
            </select>
          </label>

          <label>
            Campus Event *
            {eventsList.length > 0 ? (
              <select
                value={form.event}
                onChange={(e) => setForm({ ...form, event: e.target.value })}
                required
              >
                {eventsList.map((ev) => (
                  <option key={ev.id} value={ev.name}>
                    {ev.name} ({ev.category})
                  </option>
                ))}
                <option value="Other Campus Event">Other Campus Gathering</option>
              </select>
            ) : (
              <input
                value={form.event}
                onChange={(e) => setForm({ ...form, event: e.target.value })}
                placeholder="e.g. SRIT Tech Fest 2026"
                required
              />
            )}
          </label>

          <label>
            Segregation & Eco Cleanliness Rating *
            <select
              value={form.rating}
              onChange={(e) => setForm({ ...form, rating: e.target.value })}
            >
              <option value="5">⭐⭐⭐⭐⭐ 5 - Excellent (Bins clear, zero litter)</option>
              <option value="4">⭐⭐⭐⭐ 4 - Good (Minor contamination)</option>
              <option value="3">⭐⭐⭐ 3 - Average (Needs better labeling)</option>
              <option value="2">⭐⭐ 2 - Needs Work (Mixed bin disposal)</option>
              <option value="1">⭐ 1 - Poor (High single-use plastic overflow)</option>
            </select>
          </label>

          <label>
            Comments & Observations *
            <textarea
              rows="4"
              value={form.message}
              onChange={(e) => setForm({ ...form, message: e.target.value })}
              placeholder="Were colour-coded bins easy to locate? Were steel cups washed promptly? Any recommendations for future campus drives?"
              required
            />
          </label>

          <button type="submit" disabled={submitting}>
            {submitting ? 'Submitting...' : '💬 Submit Event Feedback'}
          </button>
        </form>

        {/* Database Feedback Entries List */}
        <article className="panel">
          <h2>Community Notes ({entries.length})</h2>
          {entries.length === 0 ? (
            <p className="hint">No feedback recorded yet. Be the first to share an observation!</p>
          ) : (
            <ul className="feedback-list">
              {entries.map((item) => (
                <li
                  key={item.id}
                  style={{
                    padding: '12px 14px',
                    borderRadius: '10px',
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <strong>{item.name}</strong>
                    <span style={{ fontSize: '0.82rem', color: '#eab308' }}>
                      {'★'.repeat(item.rating || 5)}{'☆'.repeat(Math.max(0, 5 - (item.rating || 5)))}
                    </span>
                  </div>

                  <div style={{ display: 'flex', gap: '8px', fontSize: '0.76rem', color: '#64748b', marginBottom: '6px' }}>
                    <span className="badge" style={{ fontSize: '0.7rem', padding: '2px 6px' }}>{item.role}</span>
                    <span>📍 {item.event}</span>
                    <span>🕒 {item.created_at ? item.created_at.slice(0, 16) : 'Just now'}</span>
                  </div>

                  <p style={{ margin: 0, fontSize: '0.88rem', color: '#334155', lineHeight: 1.4 }}>
                    {item.message}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </article>
      </div>
    </div>
  )
}

export default Feedback
