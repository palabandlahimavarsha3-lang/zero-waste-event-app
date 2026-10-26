import { useEffect, useState } from 'react'
import {
  addWasteLog,
  createEvent,
  deleteEvent,
  fetchEvents,
  updateEvent,
  predictDeptWaste,
  getEcoAlternatives,
  saveAuditItems,
  getAuditItems,
  editAuditItem,
  deleteAuditItem,
} from '../api'
import EventCard from '../components/EventCard'
import DataBanner from '../components/DataBanner'
import PageHeader from '../components/PageHeader'
import { events as seedEvents } from '../data/sampleData'

const emptyEvent = {
  name: '',
  venue: '',
  date: '',
  attendees: '',
  duration_hours: '4',
  category: 'Technical',
  status: 'Planning',
}

const emptyWaste = {
  eventId: '',
  category: 'recyclable',
  amount_kg: '',
  notes: '',
  reported_by: '',
}

function Events() {
  const [list, setList] = useState(seedEvents)
  const [live, setLive] = useState(null)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [form, setForm] = useState(emptyEvent)
  const [editingId, setEditingId] = useState(null)
  const [waste, setWaste] = useState(emptyWaste)
  const [statusFilter, setStatusFilter] = useState('All')
  const [searchQuery, setSearchQuery] = useState('')
  const [submittingEvent, setSubmittingEvent] = useState(false)
  const [submittingWaste, setSubmittingWaste] = useState(false)

  // 1 & 2: Waste prediction & Eco Alternatives
  const [predictedWaste, setPredictedWaste] = useState(null)
  const [predictLoading, setPredictLoading] = useState(false)
  const [ecoAlternatives, setEcoAlternatives] = useState([])
  const [selectedAlternatives, setSelectedAlternatives] = useState([])
  const [alternativesApplied, setAlternativesApplied] = useState(false)

  // 3: Post-Event Waste Audit
  const [selectedCompletedEvent, setSelectedCompletedEvent] = useState('')
  const [auditRows, setAuditRows] = useState([
    { id: 1, name: '', qty: '', unit: 'Count' },
  ])
  const [savedAuditItems, setSavedAuditItems] = useState([])
  const [savingAudit, setSavingAudit] = useState(false)
  const [auditMsg, setAuditMsg] = useState('')
  const [auditError, setAuditError] = useState('')
  const [editingAuditId, setEditingAuditId] = useState(null)
  const [editAuditForm, setEditAuditForm] = useState({ name: '', qty: '', unit: 'Count' })

  async function loadAuditRecords() {
    try {
      const items = await getAuditItems()
      setSavedAuditItems(items || [])
    } catch (err) {
      console.warn('Could not load audit records:', err)
    }
  }

  async function loadEvents() {
    try {
      const events = await fetchEvents()
      setList(events)
      setLive(true)
      setError('')
      setWaste((current) => ({
        ...current,
        eventId: current.eventId || String(events[0]?.id || ''),
      }))
      const completed = events.find((e) => e.status === 'Completed')
      setSelectedCompletedEvent((current) => current || (completed ? completed.name : events[0]?.name || ''))
    } catch {
      setLive(false)
      const completed = seedEvents.find((e) => e.status === 'Completed')
      setSelectedCompletedEvent((current) => current || (completed ? completed.name : seedEvents[0]?.name || ''))
    }
  }

  useEffect(() => {
    loadEvents()
    loadAuditRecords()
  }, [])

  function startEdit(event) {
    setEditingId(event.id)
    setForm({
      name: event.name || '',
      venue: event.venue || '',
      date: event.date || event.event_date || '',
      attendees: String(event.attendees || ''),
      duration_hours: String(event.duration_hours || '4'),
      category: event.category || 'Technical',
      status: event.status || 'Planning',
    })
    setError('')
    setSuccessMsg('')
    window.scrollTo({ top: 120, behavior: 'smooth' })
  }

  function cancelEdit() {
    setEditingId(null)
    setForm(emptyEvent)
    setError('')
  }

  function handleLogWasteClick(event) {
    setWaste((current) => ({
      ...current,
      eventId: String(event.id),
    }))
    window.scrollTo({ top: 120, behavior: 'smooth' })
  }

  async function handleDelete(event) {
    if (!window.confirm(`Are you sure you want to delete "${event.name}"? This will also remove associated waste logs.`)) {
      return
    }

    setError('')
    setSuccessMsg('')

    try {
      await deleteEvent(event.id)
      setSuccessMsg(`Event "${event.name}" deleted successfully.`)
      await loadEvents()
    } catch {
      setLive(false)
      setList((prev) => prev.filter((item) => item.id !== event.id))
      setSuccessMsg(`Event "${event.name}" removed from local list.`)
    }

    if (editingId === event.id) {
      cancelEdit()
    }
  }

  async function handleEventSubmit(e) {
    e.preventDefault()
    setError('')
    setSuccessMsg('')

    // Form Validation
    const trimmedName = form.name.trim()
    const trimmedVenue = form.venue.trim()
    const attendeesNum = Number(form.attendees)
    const durationNum = Number(form.duration_hours)

    if (!trimmedName) {
      setError('Event name is required.')
      return
    }
    if (!trimmedVenue) {
      setError('Venue is required.')
      return
    }
    if (!form.date) {
      setError('Date is required.')
      return
    }
    if (isNaN(attendeesNum) || attendeesNum < 0) {
      setError('Expected attendees must be a positive number or zero.')
      return
    }
    if (isNaN(durationNum) || durationNum <= 0 || durationNum > 24) {
      setError('Duration must be between 0.5 and 24 hours.')
      return
    }

    const payload = {
      name: trimmedName,
      venue: trimmedVenue,
      event_date: form.date,
      attendees: attendeesNum,
      duration_hours: durationNum,
      category: form.category,
      status: form.status,
    }

    setSubmittingEvent(true)

    try {
      if (editingId) {
        // Update Event
        try {
          const updated = await updateEvent(editingId, payload)
          setList((current) =>
            current.map((item) => (item.id === editingId ? updated : item)),
          )
          setLive(true)
        } catch {
          setLive(false)
          setList((current) =>
            current.map((item) =>
              item.id === editingId ? { ...item, ...payload, date: payload.event_date } : item,
            ),
          )
        }
        setSuccessMsg(`Event "${payload.name}" updated successfully!`)
        cancelEdit()
      } else {
        // Create Event
        try {
          const created = await createEvent(payload)
          setList((current) => [created, ...current])
          setLive(true)
        } catch {
          setLive(false)
          setList((current) => [
            {
              id: Date.now(),
              ...payload,
              date: payload.event_date,
              wasteKg: 0,
            },
            ...current,
          ])
        }
        setSuccessMsg(`Event "${payload.name}" registered successfully!`)

        // 1. Call POST /api/predict-waste immediately upon department event registration
        try {
          const pred = await predictDeptWaste({
            attendees: attendeesNum,
            duration: durationNum,
            category: form.category,
          })
          setPredictedWaste({ ...pred, eventName: payload.name })

          // 2. Call POST /api/get-alternatives immediately after prediction
          const altRes = await getEcoAlternatives({
            attendees: attendeesNum,
          })
          const alts = altRes.alternatives || []
          setEcoAlternatives(alts)
          setSelectedAlternatives(alts.map((a) => a.id))
          setAlternativesApplied(false)
        } catch {
          // Fallback calculation in case of connection offline
          const total_kg = Number((attendeesNum * 0.35).toFixed(2))
          setPredictedWaste({
            attendees: attendeesNum,
            duration: durationNum,
            category: form.category,
            total_kg,
            eventName: payload.name,
            breakup: {
              'Plastic Bottles': `${Math.round(attendeesNum * 1.2)} Count`,
              'Paper Cups': `${Math.round(attendeesNum * 0.8)} Count`,
              'Food Plates': `${Math.round(attendeesNum * 1.0)} Count`,
              'Food Waste': `${(attendeesNum * 0.15).toFixed(2)} kg`,
              'Paper Waste': `${(attendeesNum * 0.08).toFixed(2)} kg`,
            },
          })
          const fallbackAlts = [
            {
              id: 'plastic_bottles',
              item: 'Plastic Bottles',
              action: 'Water Dispensers + Steel Glasses',
              impact: 'Save 80%',
              cost_saved: `Save ₹${Math.max(1500, Math.round(attendeesNum * 12))}`,
            },
            {
              id: 'paper_cups_plates',
              item: 'Paper Cups/Plates',
              action: 'Areca Leaf Plates + Clay Kulhads',
              impact: '100% biodegradable',
              cost_saved: `Save ₹${Math.max(800, Math.round(attendeesNum * 6))}`,
            },
            {
              id: 'food_waste',
              item: 'Food Waste',
              action: 'RSVP Form + NGO Donation Tie-up',
              impact: 'Reduce 50%',
              cost_saved: `Save ₹${Math.max(1200, Math.round(attendeesNum * 10))}`,
            },
            {
              id: 'paper_banners',
              item: 'Paper Banners',
              action: 'Digital Boards + Cloth Banners',
              impact: 'Save ₹2000',
              cost_saved: 'Save ₹2000',
            },
          ]
          setEcoAlternatives(fallbackAlts)
          setSelectedAlternatives(fallbackAlts.map((a) => a.id))
          setAlternativesApplied(false)
        }

        setForm(emptyEvent)
      }
    } catch (err) {
      setError(err.message || 'Failed to save event.')
    } finally {
      setSubmittingEvent(false)
    }
  }

  async function handleQuickPredict() {
    const attendeesNum = Number(form.attendees)
    const durationNum = Number(form.duration_hours) || 4
    if (isNaN(attendeesNum) || attendeesNum <= 0) {
      setError('Please enter expected attendees (> 0) to forecast waste.')
      return
    }
    setError('')
    setPredictLoading(true)
    try {
      const pred = await predictDeptWaste({
        attendees: attendeesNum,
        duration: durationNum,
        category: form.category,
      })
      setPredictedWaste(pred)

      const altRes = await getEcoAlternatives({
        attendees: attendeesNum,
      })
      const alts = altRes.alternatives || []
      setEcoAlternatives(alts)
      setSelectedAlternatives(alts.map((a) => a.id))
      setAlternativesApplied(false)
    } catch {
      const total_kg = Number((attendeesNum * 0.35).toFixed(2))
      setPredictedWaste({
        attendees: attendeesNum,
        duration: durationNum,
        category: form.category,
        total_kg,
        breakup: {
          'Plastic Bottles': `${Math.round(attendeesNum * 1.2)} Count`,
          'Paper Cups': `${Math.round(attendeesNum * 0.8)} Count`,
          'Food Plates': `${Math.round(attendeesNum * 1.0)} Count`,
          'Food Waste': `${(attendeesNum * 0.15).toFixed(2)} kg`,
          'Paper Waste': `${(attendeesNum * 0.08).toFixed(2)} kg`,
        },
      })
      const fallbackAlts = [
        {
          id: 'plastic_bottles',
          item: 'Plastic Bottles',
          action: 'Water Dispensers + Steel Glasses',
          impact: 'Save 80%',
          cost_saved: `Save ₹${Math.max(1500, Math.round(attendeesNum * 12))}`,
        },
        {
          id: 'paper_cups_plates',
          item: 'Paper Cups/Plates',
          action: 'Areca Leaf Plates + Clay Kulhads',
          impact: '100% biodegradable',
          cost_saved: `Save ₹${Math.max(800, Math.round(attendeesNum * 6))}`,
        },
        {
          id: 'food_waste',
          item: 'Food Waste',
          action: 'RSVP Form + NGO Donation Tie-up',
          impact: 'Reduce 50%',
          cost_saved: `Save ₹${Math.max(1200, Math.round(attendeesNum * 10))}`,
        },
        {
          id: 'paper_banners',
          item: 'Paper Banners',
          action: 'Digital Boards + Cloth Banners',
          impact: 'Save ₹2000',
          cost_saved: 'Save ₹2000',
        },
      ]
      setEcoAlternatives(fallbackAlts)
      setSelectedAlternatives(fallbackAlts.map((a) => a.id))
      setAlternativesApplied(false)
    } finally {
      setPredictLoading(false)
    }
  }

  function handleToggleAlternative(id) {
    setSelectedAlternatives((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    )
  }

  function handleAcceptAndApplyAlternatives() {
    if (selectedAlternatives.length === 0) {
      alert('Please check at least one eco-alternative to apply.')
      return
    }
    setAlternativesApplied(true)
  }

  // -------------------------------------------------------------
  // Handlers for Post-Event Waste Audit
  // -------------------------------------------------------------
  function handleAddAuditRow() {
    setAuditRows((prev) => [
      ...prev,
      { id: Date.now() + Math.random(), name: '', qty: '', unit: 'Count' },
    ])
  }

  function handleDeleteAuditRow(rowId) {
    setAuditRows((prev) => {
      const filtered = prev.filter((r) => r.id !== rowId)
      return filtered.length === 0
        ? [{ id: Date.now(), name: '', qty: '', unit: 'Count' }]
        : filtered
    })
  }

  function handleUpdateAuditRow(rowId, field, value) {
    setAuditRows((prev) =>
      prev.map((r) => (r.id === rowId ? { ...r, [field]: value } : r)),
    )
  }

  async function handleSaveAllAuditItems() {
    setAuditError('')
    setAuditMsg('')

    const eventTarget = selectedCompletedEvent || (list.find((e) => e.status === 'Completed')?.name || list[0]?.name)
    if (!eventTarget) {
      setAuditError('Please select or specify an event for the audit.')
      return
    }

    const validRows = auditRows.filter(
      (r) => r.name && r.name.trim() !== '' && r.qty !== '' && !isNaN(Number(r.qty)) && Number(r.qty) >= 0,
    )

    if (validRows.length === 0) {
      setAuditError('Please enter at least one item with a valid Item Type and non-negative Quantity.')
      return
    }

    setSavingAudit(true)
    try {
      const payload = {
        event: eventTarget,
        items: validRows.map((r) => ({
          name: r.name.trim(),
          qty: Number(r.qty),
          unit: r.unit || 'Count',
        })),
      }
      await saveAuditItems(payload)
      setAuditMsg(`Successfully saved ${validRows.length} waste audit item(s) for "${eventTarget}"!`)
      setAuditRows([{ id: Date.now(), name: '', qty: '', unit: 'Count' }])
      await loadAuditRecords()
    } catch (err) {
      setAuditError(err.message || 'Failed to save audit items.')
    } finally {
      setSavingAudit(false)
    }
  }

  function handleStartEditAudit(item) {
    setEditingAuditId(item.id)
    setEditAuditForm({
      name: item.name,
      qty: item.qty,
      unit: item.unit,
    })
    setAuditError('')
    setAuditMsg('')
  }

  function handleCancelEditAudit() {
    setEditingAuditId(null)
    setEditAuditForm({ name: '', qty: '', unit: 'Count' })
  }

  async function handleSaveEditAudit(id) {
    if (!editAuditForm.name.trim()) {
      setAuditError('Item name cannot be empty.')
      return
    }
    const qtyNum = Number(editAuditForm.qty)
    if (isNaN(qtyNum) || qtyNum < 0) {
      setAuditError('Quantity must be a valid number >= 0.')
      return
    }

    try {
      await editAuditItem(id, {
        name: editAuditForm.name.trim(),
        qty: qtyNum,
        unit: editAuditForm.unit,
      })
      setAuditMsg('Audit item updated successfully.')
      setEditingAuditId(null)
      await loadAuditRecords()
    } catch (err) {
      setAuditError(err.message || 'Failed to update audit item.')
    }
  }

  async function handleDeleteSavedAudit(id, itemName) {
    if (!window.confirm(`Are you sure you want to delete audit item "${itemName}"?`)) return
    try {
      await deleteAuditItem(id)
      setAuditMsg(`Audit item "${itemName}" deleted successfully.`)
      await loadAuditRecords()
    } catch (err) {
      setAuditError(err.message || 'Failed to delete audit item.')
    }
  }

  async function handleWasteSubmit(e) {
    e.preventDefault()
    setError('')
    setSuccessMsg('')

    if (!waste.eventId) {
      setError('Please select an event to log waste.')
      return
    }

    const amount = Number(waste.amount_kg)
    if (isNaN(amount) || amount <= 0) {
      setError('Waste amount must be a positive number in kg.')
      return
    }

    setSubmittingWaste(true)

    try {
      await addWasteLog(waste.eventId, {
        category: waste.category,
        amount_kg: amount,
        notes: waste.notes.trim(),
        reported_by: waste.reported_by.trim() || 'Volunteer',
      })

      const targetEvent = list.find((item) => String(item.id) === String(waste.eventId))
      setSuccessMsg(
        `Logged ${amount} kg of ${waste.category} waste for "${targetEvent?.name || 'event'}"!`,
      )
      setWaste({ ...emptyWaste, eventId: waste.eventId })
      setLive(true)
      await loadEvents()
    } catch {
      setLive(false)
      // Update local list
      setList((current) =>
        current.map((item) =>
          String(item.id) === String(waste.eventId)
            ? { ...item, wasteKg: (item.wasteKg || 0) + amount }
            : item,
        ),
      )
      setSuccessMsg(`Logged ${amount} kg of ${waste.category} waste locally.`)
      setWaste({ ...emptyWaste, eventId: waste.eventId })
    } finally {
      setSubmittingWaste(false)
    }
  }

  const filteredList = list.filter((item) => {
    const matchesStatus =
      statusFilter === 'All' || item.status === statusFilter
    const matchesSearch =
      !searchQuery.trim() ||
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.venue.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.category.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesStatus && matchesSearch
  })

  return (
    <div className="page">
      <PageHeader
        eyebrow="Event Management"
        title="Campus Events & Waste Tracking"
        subtitle="Register, update, and manage campus events, and log verified recyclable, compost, and landfill waste weights."
      />
      <DataBanner
        live={live}
        message={live ? 'Connected to SQLite database via Flask REST API.' : 'API offline — events stored in local session.'}
      />

      {error && <p className="form-error" style={{ marginBottom: '16px' }}>⚠ {error}</p>}
      {successMsg && <p className="success" style={{ marginBottom: '16px' }}>✓ {successMsg}</p>}

      <div className="split">
        {/* Event Form: Add or Edit */}
        <form className="panel form" onSubmit={handleEventSubmit}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2>{editingId ? 'Edit Event' : 'Register an Event'}</h2>
            {editingId && (
              <button
                type="button"
                className="btn-secondary"
                style={{ padding: '4px 10px', fontSize: '0.78rem' }}
                onClick={cancelEdit}
              >
                Cancel Edit
              </button>
            )}
          </div>

          <label>
            Event Name *
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. SRIT Annual Science Expo"
              required
            />
          </label>

          <label>
            Venue / Campus Location *
            <input
              value={form.venue}
              onChange={(e) => setForm({ ...form, venue: e.target.value })}
              placeholder="e.g. Main Auditorium / Central Lawn"
              required
            />
          </label>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <label>
              Event Date *
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                required
              />
            </label>

            <label>
              Duration (Hours) *
              <input
                type="number"
                min="0.5"
                max="24"
                step="0.5"
                value={form.duration_hours}
                onChange={(e) => setForm({ ...form, duration_hours: e.target.value })}
                required
              />
            </label>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <label>
              Expected Attendees *
              <input
                type="number"
                min="0"
                value={form.attendees}
                onChange={(e) => setForm({ ...form, attendees: e.target.value })}
                placeholder="e.g. 450"
                required
              />
            </label>

            <label>
              Event Status
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
              >
                <option value="Planning">Planning</option>
                <option value="Upcoming">Upcoming</option>
                <option value="Completed">Completed</option>
              </select>
            </label>
          </div>

          <label>
            Category
            <select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            >
              <option value="Technical">Technical</option>
              <option value="Cultural">Cultural</option>
              <option value="Food">Food</option>
              <option value="Sports">Sports</option>
              <option value="Awareness">Awareness</option>
              <option value="Student Club">Student Club</option>
              <option value="Campus">Campus</option>
            </select>
          </label>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button type="submit" disabled={submittingEvent} style={{ flex: 1, minWidth: '150px' }}>
              {submittingEvent ? 'Saving...' : editingId ? '💾 Save Changes' : '➕ Register Event'}
            </button>
            {!editingId && (
              <button
                type="button"
                className="btn-secondary"
                disabled={predictLoading}
                onClick={handleQuickPredict}
                title="Forecast expected waste and eco-alternatives right now"
                style={{ padding: '9px 14px', fontSize: '0.85rem', whiteSpace: 'nowrap' }}
              >
                {predictLoading ? 'Forecasting...' : '⚡ Instant Forecast'}
              </button>
            )}
          </div>

          {/* 1. GREEN BOX: PREDICT WASTE WHEN DEPT REGISTERS */}
          {predictedWaste && (
            <div className="predict-green-box" id="waste-prediction-result">
              <div className="predict-green-header">
                <h4 className="predict-green-title">
                  <span>🌿</span>
                  <span>Waste Prediction Forecast</span>
                </h4>
                <span className="predict-green-badge">
                  {predictedWaste.category} • {predictedWaste.attendees} Attendees
                </span>
              </div>

              <div className="predict-total-highlight">
                <span className="predict-total-label">Total Estimated Waste:</span>
                <span className="predict-total-val">{predictedWaste.total_kg} kg</span>
                <span style={{ fontSize: '0.78rem', color: '#166534', marginLeft: 'auto' }}>
                  ({predictedWaste.attendees} × 0.35 kg/attendee)
                </span>
              </div>

              <div className="predict-breakup-grid">
                <div className="predict-breakup-item">
                  <span className="predict-breakup-name">🥤 Plastic Bottles</span>
                  <span className="predict-breakup-val">{predictedWaste.breakup?.['Plastic Bottles']}</span>
                </div>
                <div className="predict-breakup-item">
                  <span className="predict-breakup-name">☕ Paper Cups</span>
                  <span className="predict-breakup-val">{predictedWaste.breakup?.['Paper Cups']}</span>
                </div>
                <div className="predict-breakup-item">
                  <span className="predict-breakup-name">🍽️ Food Plates</span>
                  <span className="predict-breakup-val">{predictedWaste.breakup?.['Food Plates']}</span>
                </div>
                <div className="predict-breakup-item">
                  <span className="predict-breakup-name">🥗 Food Waste</span>
                  <span className="predict-breakup-val">{predictedWaste.breakup?.['Food Waste']}</span>
                </div>
                <div className="predict-breakup-item">
                  <span className="predict-breakup-name">📄 Paper Waste</span>
                  <span className="predict-breakup-val">{predictedWaste.breakup?.['Paper Waste']}</span>
                </div>
              </div>
            </div>
          )}

          {/* 2. YELLOW BOX: SUGGEST ALTERNATIVES BEFORE EVENT STARTS */}
          {ecoAlternatives && ecoAlternatives.length > 0 && (
            <div className="alt-yellow-box" id="eco-alternatives-result">
              <div className="alt-yellow-header">
                <h4 className="alt-yellow-title">
                  <span>💡</span>
                  <span>Eco Alternatives - Reduce Waste BEFORE Event</span>
                </h4>
                <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#92400e', background: '#fef3c7', padding: '2px 8px', borderRadius: '6px' }}>
                  Pre-Event Action Plan
                </span>
              </div>

              <div className="alt-yellow-list">
                {ecoAlternatives.map((alt) => {
                  const isChecked = selectedAlternatives.includes(alt.id)
                  return (
                    <div key={alt.id} className="alt-item-row">
                      <input
                        type="checkbox"
                        className="alt-item-checkbox"
                        id={`alt-chk-${alt.id}`}
                        checked={isChecked}
                        onChange={() => handleToggleAlternative(alt.id)}
                      />
                      <div className="alt-item-content">
                        <label
                          htmlFor={`alt-chk-${alt.id}`}
                          className="alt-item-main"
                          style={{ cursor: 'pointer', margin: 0 }}
                        >
                          <span style={{ color: '#0f172a' }}>{alt.item}</span>
                          <span className="alt-arrow">→</span>
                          <span className="alt-action">{alt.action}</span>
                        </label>
                        <div className="alt-badges">
                          <span className="alt-badge-impact">⚡ Impact: {alt.impact}</span>
                          <span className="alt-badge-cost">💰 Cost Saved: {alt.cost_saved}</span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              <button
                type="button"
                className="alt-apply-btn"
                onClick={handleAcceptAndApplyAlternatives}
              >
                🌿 Accept & Apply ({selectedAlternatives.length} Selected)
              </button>

              {alternativesApplied && (
                <div className="alt-applied-banner">
                  ✓ Eco Alternatives Accepted & Applied to event setup plan!
                </div>
              )}
            </div>
          )}
        </form>

        {/* Waste Log Form */}
        <form className="panel form" onSubmit={handleWasteSubmit}>
          <h2>Log Actual Waste (Weighed)</h2>
          <p className="hint" style={{ fontSize: '0.82rem', margin: '0 0 10px' }}>
            Record actual weighed measurements gathered from event collection stations.
          </p>

          <label>
            Select Event *
            <select
              value={waste.eventId}
              onChange={(e) => setWaste({ ...waste, eventId: e.target.value })}
              required
            >
              {list.length === 0 && <option value="">No events registered yet</option>}
              {list.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.name} ({ev.category})
                </option>
              ))}
            </select>
          </label>

          <label>
            Waste Stream *
            <select
              value={waste.category}
              onChange={(e) => setWaste({ ...waste, category: e.target.value })}
            >
              <option value="recyclable">♻️ Recyclable (Bottles, paper, clean plastic)</option>
              <option value="compost">🌱 Compost (Food leftovers, fruit peels, garden)</option>
              <option value="landfill">🗑️ Landfill (Mixed wrappers, non-recyclables)</option>
            </select>
          </label>

          <label>
            Measured Amount (kg) *
            <input
              type="number"
              min="0.1"
              step="0.1"
              value={waste.amount_kg}
              onChange={(e) => setWaste({ ...waste, amount_kg: e.target.value })}
              placeholder="e.g. 14.5"
              required
            />
          </label>

          <label>
            Reported By / Team
            <input
              value={waste.reported_by}
              onChange={(e) => setWaste({ ...waste, reported_by: e.target.value })}
              placeholder="e.g. NSS Green Cell / Eco Club"
            />
          </label>

          <label>
            Station Notes
            <input
              value={waste.notes}
              onChange={(e) => setWaste({ ...waste, notes: e.target.value })}
              placeholder="e.g. Sorted PET water bottles from auditorium foyer"
            />
          </label>

          <button type="submit" disabled={submittingWaste}>
            {submittingWaste ? 'Saving...' : '⚖️ Record Waste Weight'}
          </button>
        </form>
      </div>

      {/* Filter and Search Bar for Events List */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center', justifyContent: 'space-between', margin: '24px 0 16px' }}>
        <h2 style={{ margin: 0 }}>Registered Events ({filteredList.length})</h2>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search events by name, venue..."
            style={{ width: '220px', padding: '6px 12px', fontSize: '0.85rem' }}
          />

          <div style={{ display: 'flex', gap: '4px' }}>
            {['All', 'Upcoming', 'Planning', 'Completed'].map((status) => (
              <button
                key={status}
                type="button"
                className={`pill-btn ${statusFilter === status ? 'active' : ''}`}
                onClick={() => setStatusFilter(status)}
              >
                {status}
              </button>
            ))}
          </div>
        </div>
      </div>

      {filteredList.length === 0 ? (
        <div className="panel" style={{ textAlign: 'center', padding: '36px 20px' }}>
          <p className="hint" style={{ fontSize: '1rem' }}>No events match your search or filter.</p>
        </div>
      ) : (
        <div className="card-grid">
          {filteredList.map((campusEvent) => (
            <EventCard
              key={campusEvent.id}
              event={campusEvent}
              onEdit={startEdit}
              onDelete={handleDelete}
              onLogWaste={handleLogWasteClick}
              isSelected={editingId === campusEvent.id}
            />
          ))}
        </div>
      )}

      {/* 3. NEW CARD: POST-EVENT WASTE AUDIT FOR ALL ITEMS (NOT ONLY BOTTLES) */}
      <section className="audit-card" id="post-event-waste-audit">
        <div className="audit-header">
          <div>
            <span style={{ color: 'var(--green-700)', fontWeight: 700, fontSize: '0.76rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Comprehensive Audit Module
            </span>
            <h2 style={{ margin: '4px 0 0', color: 'var(--ink)' }}>Post-Event Waste Audit (Editable)</h2>
            <p className="hint" style={{ fontSize: '0.86rem', margin: '4px 0 0' }}>
              Audit any item category after an event concludes (e.g. Cardboard, Food Scraps, Cloth Badges, Aluminum Cans, Flex Banners) with custom units.
            </p>
          </div>

          {/* Select Completed Event dropdown */}
          <div style={{ minWidth: '260px' }}>
            <label htmlFor="audit-event-dropdown" style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--ink)', marginBottom: '4px' }}>
              Select Completed Event *
            </label>
            <select
              id="audit-event-dropdown"
              value={selectedCompletedEvent}
              onChange={(e) => setSelectedCompletedEvent(e.target.value)}
            >
              {list.filter((ev) => ev.status === 'Completed').length > 0 && (
                <optgroup label="Completed Events">
                  {list
                    .filter((ev) => ev.status === 'Completed')
                    .map((ev) => (
                      <option key={ev.id} value={ev.name}>
                        ✓ {ev.name} ({ev.category})
                      </option>
                    ))}
                </optgroup>
              )}
              {list.filter((ev) => ev.status !== 'Completed').length > 0 && (
                <optgroup label="Other Campus Events">
                  {list
                    .filter((ev) => ev.status !== 'Completed')
                    .map((ev) => (
                      <option key={ev.id} value={ev.name}>
                        {ev.name} ({ev.status})
                      </option>
                    ))}
                </optgroup>
              )}
            </select>
          </div>
        </div>

        {/* Editable Table */}
        <div className="audit-table-wrapper">
          <table className="audit-table">
            <thead>
              <tr>
                <th style={{ width: '45%' }}>Item Type</th>
                <th style={{ width: '25%' }}>Quantity</th>
                <th style={{ width: '20%' }}>Unit</th>
                <th style={{ width: '10%', textAlign: 'center' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {auditRows.map((row) => (
                <tr key={row.id}>
                  <td>
                    <input
                      className="audit-input"
                      placeholder="Enter any item (e.g. Flex Banners, Food Scraps, Cardboard Boxes)"
                      value={row.name}
                      onChange={(e) => handleUpdateAuditRow(row.id, 'name', e.target.value)}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      className="audit-input"
                      placeholder="e.g. 25"
                      value={row.qty}
                      onChange={(e) => handleUpdateAuditRow(row.id, 'qty', e.target.value)}
                    />
                  </td>
                  <td>
                    <select
                      className="audit-input"
                      value={row.unit}
                      onChange={(e) => handleUpdateAuditRow(row.id, 'unit', e.target.value)}
                    >
                      <option value="Count">Count</option>
                      <option value="kg">kg</option>
                      <option value="Bags">Bags</option>
                    </select>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <button
                      type="button"
                      className="btn-delete-row"
                      onClick={() => handleDeleteAuditRow(row.id)}
                      title="Delete row"
                    >
                      ✕ Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Action Buttons: Add More Item & Save All Waste Items */}
        <div className="audit-actions-bar">
          <button
            type="button"
            className="btn-add-row"
            onClick={handleAddAuditRow}
          >
            ➕ + Add More Item
          </button>

          <button
            type="button"
            className="btn-save-audit"
            onClick={handleSaveAllAuditItems}
            disabled={savingAudit}
          >
            {savingAudit ? 'Saving Audit Records...' : '💾 Save All Waste Items'}
          </button>
        </div>

        {auditMsg && (
          <div className="success" style={{ marginBottom: '16px', padding: '10px 14px', background: 'var(--green-50)', borderRadius: '8px', border: '1px solid #86efac' }}>
            ✓ {auditMsg}
          </div>
        )}
        {auditError && (
          <div className="form-error" style={{ marginBottom: '16px', padding: '10px 14px', background: '#fef2f2', borderRadius: '8px', border: '1px solid #fca5a5' }}>
            ⚠ {auditError}
          </div>
        )}

        {/* Saved Audit Items List */}
        <div className="saved-audit-section">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
            <h3 style={{ margin: 0, fontSize: '1rem', color: 'var(--ink)' }}>
              Saved Waste Audit Records ({savedAuditItems.length})
            </h3>
            <button
              type="button"
              className="pill-btn"
              style={{ padding: '4px 10px', fontSize: '0.78rem' }}
              onClick={() => loadAuditRecords()}
            >
              🔄 Refresh List
            </button>
          </div>

          {savedAuditItems.length === 0 ? (
            <p className="hint" style={{ fontSize: '0.85rem', fontStyle: 'italic', margin: '10px 0' }}>
              No audit records saved yet. Fill in items above and click "Save All Waste Items".
            </p>
          ) : (
            <div className="audit-table-wrapper">
              <table className="saved-audit-table">
                <thead>
                  <tr>
                    <th style={{ width: '25%' }}>Event</th>
                    <th style={{ width: '35%' }}>Item Type</th>
                    <th style={{ width: '15%' }}>Quantity</th>
                    <th style={{ width: '10%' }}>Unit</th>
                    <th style={{ width: '15%', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {savedAuditItems.map((item) => (
                    <tr key={item.id}>
                      {editingAuditId === item.id ? (
                        <>
                          <td>
                            <span className="badge badge-completed">{item.event}</span>
                          </td>
                          <td>
                            <input
                              className="audit-input"
                              value={editAuditForm.name}
                              onChange={(e) => setEditAuditForm({ ...editAuditForm, name: e.target.value })}
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              min="0"
                              step="any"
                              className="audit-input"
                              value={editAuditForm.qty}
                              onChange={(e) => setEditAuditForm({ ...editAuditForm, qty: e.target.value })}
                            />
                          </td>
                          <td>
                            <select
                              className="audit-input"
                              value={editAuditForm.unit}
                              onChange={(e) => setEditAuditForm({ ...editAuditForm, unit: e.target.value })}
                            >
                              <option value="Count">Count</option>
                              <option value="kg">kg</option>
                              <option value="Bags">Bags</option>
                            </select>
                          </td>
                          <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                            <button
                              type="button"
                              className="btn-save-item"
                              onClick={() => handleSaveEditAudit(item.id)}
                            >
                              💾 Save
                            </button>
                            <button
                              type="button"
                              className="btn-cancel-item"
                              onClick={handleCancelEditAudit}
                            >
                              ✕ Cancel
                            </button>
                          </td>
                        </>
                      ) : (
                        <>
                          <td>
                            <span className="badge" style={{ background: '#e0f2fe', color: '#0369a1' }}>
                              {item.event}
                            </span>
                          </td>
                          <td style={{ fontWeight: 600, color: 'var(--ink)' }}>{item.name}</td>
                          <td style={{ fontWeight: 700, color: 'var(--green-800)' }}>{item.qty}</td>
                          <td>
                            <span className="saved-pill">{item.unit}</span>
                          </td>
                          <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                            <button
                              type="button"
                              className="btn-edit-item"
                              onClick={() => handleStartEditAudit(item)}
                            >
                              ✏️ Edit
                            </button>
                            <button
                              type="button"
                              className="btn-delete-row"
                              onClick={() => handleDeleteSavedAudit(item.id, item.name)}
                            >
                              🗑️ Delete
                            </button>
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}

export default Events
