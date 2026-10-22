import { useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'

const links = [
  { to: '/', label: 'Dashboard' },
  { to: '/events', label: 'Events' },
  { to: '/prediction', label: 'Waste Prediction' },
  { to: '/alternatives', label: 'Eco-Friendly Alternatives' },
  { to: '/reports', label: 'Waste Reports' },
  { to: '/feedback', label: 'Feedback' },
  { to: '/about', label: 'About Project' },
]

const titles = {
  '/': 'Dashboard',
  '/events': 'Events',
  '/prediction': 'Waste Prediction',
  '/alternatives': 'Eco-Friendly Alternatives',
  '/reports': 'Waste Reports',
  '/feedback': 'Feedback',
  '/about': 'About Project',
}

function AppLayout() {
  const [open, setOpen] = useState(false)
  const location = useLocation()
  const pageTitle = titles[location.pathname] || 'Zero Waste Event App'

  function closeMenu() {
    setOpen(false)
  }

  return (
    <div className={open ? 'app-shell menu-open' : 'app-shell'}>
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            ZW
          </span>
          <div>
            <p className="brand-name">Zero Waste</p>
            <p className="brand-sub">SRIT Campus</p>
          </div>
        </div>

        <nav className="side-nav" aria-label="Main">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.to === '/'}
              className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
              onClick={closeMenu}
            >
              {link.label}
            </NavLink>
          ))}
        </nav>

        <p className="sidebar-foot">College mini project · Flask + SQLite</p>
      </aside>

      {open ? <button className="backdrop" type="button" aria-label="Close menu" onClick={closeMenu} /> : null}

      <div className="main-wrap">
        <header className="topbar">
          <button className="menu-btn" type="button" onClick={() => setOpen((value) => !value)}>
            Menu
          </button>
          <div>
            <p className="topbar-kicker">Zero Waste Event App</p>
            <h2>{pageTitle}</h2>
          </div>
        </header>
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export default AppLayout
