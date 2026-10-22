function EventCard({ event, onEdit, onDelete, onLogWaste, isSelected }) {
  const status = event.status || 'Upcoming'
  const statusClass = status.toLowerCase().replace(/ /g, '-')

  return (
    <article
      className={`event-card ${isSelected ? 'selected' : ''}`}
      style={isSelected ? { borderColor: 'var(--green-700)', boxShadow: '0 0 0 2px var(--green-600)' } : {}}
    >
      <div className="event-card-top">
        <span className={`badge badge-${statusClass}`}>{status}</span>
        <span className="event-category">{event.category || 'Campus'}</span>
      </div>
      <h3>{event.name}</h3>
      <p className="muted" style={{ margin: '2px 0' }}>📍 {event.venue}</p>
      <p className="muted" style={{ margin: '2px 0 8px' }}>📅 {event.date || event.event_date}</p>
      <div className="event-meta">
        <span>👥 {event.attendees || 0} pax</span>
        <span>⏱️ {event.duration_hours || 4}h</span>
        <span>⚖️ {Number(event.wasteKg || 0).toFixed(1)} kg waste</span>
      </div>

      {(onEdit || onDelete || onLogWaste) && (
        <div
          style={{
            display: 'flex',
            gap: '6px',
            marginTop: '12px',
            paddingTop: '10px',
            borderTop: '1px solid var(--line)',
          }}
        >
          {onEdit && (
            <button
              type="button"
              className="btn-secondary"
              style={{ padding: '5px 10px', fontSize: '0.78rem', flex: 1 }}
              onClick={() => onEdit(event)}
            >
              ✏️ Edit
            </button>
          )}
          {onLogWaste && (
            <button
              type="button"
              className="btn-secondary"
              style={{ padding: '5px 10px', fontSize: '0.78rem', flex: 1 }}
              onClick={() => onLogWaste(event)}
            >
              + Log Waste
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              style={{
                padding: '5px 10px',
                fontSize: '0.78rem',
                background: '#fee2e2',
                color: '#b91c1c',
                border: '1px solid #fca5a5',
                cursor: 'pointer',
              }}
              onClick={() => onDelete(event)}
              title="Delete event"
            >
              🗑️
            </button>
          )}
        </div>
      )}
    </article>
  )
}

export default EventCard
