function Footer() {
  return (
    <footer className="app-footer">
      <div className="container footer-inner">
        <p>© {new Date().getFullYear()} Federated Learning for Gastric Cancer Research</p>
        <a href="#/privacy">Privacy</a>
      </div>
    </footer>
  )
}

export default Footer

