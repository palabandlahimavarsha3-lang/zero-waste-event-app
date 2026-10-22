function PageHeader({ eyebrow, title, subtitle }) {
  return (
    <header className="page-header">
      <p className="eyebrow">{eyebrow}</p>
      <h1>{title}</h1>
      <p className="subtitle">{subtitle}</p>
    </header>
  )
}

export default PageHeader
