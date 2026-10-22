const requestTimeout = 5000

async function request(path, options = {}) {
  const response = await fetch(path, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    signal: AbortSignal.timeout(requestTimeout),
    ...options,
  })

  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(data.error || `Request failed (${response.status})`)
  }
  return data
}

export function mapEvent(row) {
  return {
    id: row.id,
    name: row.name,
    venue: row.venue,
    date: row.event_date || row.date,
    event_date: row.event_date || row.date,
    attendees: Number(row.attendees || 0),
    duration_hours: Number(row.duration_hours || 4),
    status: row.status || 'Upcoming',
    wasteKg: Number(row.total_waste_kg ?? row.wasteKg ?? 0),
    category: row.category || 'Campus',
  }
}

export function checkHealth() {
  return request('/api/health')
}

export function fetchEvents() {
  return request('/api/events').then((rows) => rows.map(mapEvent))
}

export function fetchEvent(id) {
  return request(`/api/events/${id}`).then(mapEvent)
}

export function createEvent(payload) {
  return request('/api/events', {
    method: 'POST',
    body: JSON.stringify(payload),
  }).then(mapEvent)
}

export function updateEvent(id, payload) {
  return request(`/api/events/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  }).then(mapEvent)
}

export function deleteEvent(id) {
  return request(`/api/events/${id}`, {
    method: 'DELETE',
  })
}

export function addWasteLog(eventId, payload) {
  return request(`/api/events/${eventId}/waste`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function fetchWasteReports(eventId = null) {
  const query = eventId ? `?event_id=${eventId}` : ''
  return request(`/api/waste-reports${query}`)
}

export function createWasteReport(payload) {
  return request('/api/waste-reports', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function fetchSummary() {
  return request('/api/summary')
}

export function fetchReports() {
  return request('/api/reports')
}

export function fetchFeedback() {
  return request('/api/feedback')
}

export function submitFeedback(payload) {
  return request('/api/feedback', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function fetchPredictionMeasures() {
  return request('/api/predictions/measures')
}

export function fetchPredictions(eventId = null) {
  const query = eventId ? `?event_id=${eventId}` : ''
  return request(`/api/predictions${query}`)
}

export function generatePrediction(payload, eventId = null) {
  const endpoint = eventId ? `/api/events/${eventId}/predictions` : '/api/predictions'
  return request(endpoint, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function fetchRecommendations(params = {}) {
  const searchParams = new URLSearchParams()
  if (params.prediction_id) searchParams.set('prediction_id', params.prediction_id)
  if (params.event_id) searchParams.set('event_id', params.event_id)
  if (params.event_type) searchParams.set('event_type', params.event_type)
  if (params.waste_stream) searchParams.set('waste_stream', params.waste_stream)
  const query = searchParams.toString() ? `?${searchParams.toString()}` : ''
  return request(`/api/recommendations${query}`)
}

export function fetchTailoredRecommendations(payload) {
  return request('/api/recommendations', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function fetchPractices() {
  return request('/api/practices')
}

export function predictDeptWaste(payload) {
  return request('/api/predict-waste', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function getEcoAlternatives(payload) {
  return request('/api/get-alternatives', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function saveAuditItems(payload) {
  return request('/api/save-audit-items', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function getAuditItems(event = null) {
  const query = event ? `?event=${encodeURIComponent(event)}` : ''
  return request(`/api/get-audit-items${query}`)
}

export function editAuditItem(id, payload) {
  return request(`/api/edit-audit-item/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

export function deleteAuditItem(id) {
  return request(`/api/edit-audit-item/${id}`, {
    method: 'DELETE',
  })
}
