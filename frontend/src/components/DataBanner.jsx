function DataBanner({ live, message }) {
  // Only display banner if an actual failure occurred (live === false)
  if (live !== false) {
    return null
  }
  return (
    <p className="data-banner fallback" role="alert">
      {message}
    </p>
  )
}

export default DataBanner

