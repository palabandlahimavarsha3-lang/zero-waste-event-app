function DataBanner({ live, message }) {
  return (
    <p className={live ? 'data-banner live' : 'data-banner fallback'}>
      {message}
    </p>
  )
}

export default DataBanner
