import PageHeader from '../components/PageHeader'

function About() {
  return (
    <div className="page">
      <PageHeader
        eyebrow="College mini project"
        title="About the Zero Waste Event App"
        subtitle="A sustainability tool for Srinivasa Ramanujan Institute of Technology, Anantapur campus events."
      />

      <div className="split">
        <article className="panel about-copy">
          <h2>Purpose</h2>
          <p>
            Campus fests, workshops, and club days generate mixed waste in a short time. This app helps student
            organisers plan bins, estimate waste, suggest greener materials, and review reports after the event.
          </p>
          <h2>Who it is for</h2>
          <p>
            Event coordinators, NSS / Eco Club volunteers, and faculty mentors who want a simple record of recyclable,
            compost, and landfill waste on SRIT campus.
          </p>
          <h2>Current build</h2>
          <ul>
            <li>Frontend: React with Vite</li>
            <li>Routing: React Router</li>
            <li>Charts: Recharts</li>
            <li>Backend: Flask API with SQLite</li>
            <li>Live pages: Dashboard, Events, Waste Prediction, Eco Alternatives, Reports, and Feedback</li>
          </ul>
        </article>

        <article className="panel">
          <h2>Project modules</h2>
          <ol className="module-list">
            <li>Dashboard with campus statistics</li>
            <li>Event cards and registration form</li>
            <li>Waste prediction from event type and crowd size</li>
            <li>Eco-friendly alternatives for common materials</li>
            <li>Waste reports with charts and tables</li>
            <li>Feedback from students and volunteers</li>
          </ol>
          <p className="hint">If Flask is not running, Dashboard, Events, Reports, and Feedback fall back to sample data.</p>
        </article>
      </div>
    </div>
  )
}

export default About
