import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

function Header() {
  const { user, logout } = useAuth()

  const handleLogout = () => {
    logout()
  }

  return (
    <header className="app-header">
      <div className="container header-inner">
        <Link to="/" className="brand">
          <span className="logo" aria-hidden="true">∑</span>
          <span className="brand-text">Gastric FL</span>
        </Link>
        <nav className="nav">
          {user ? (
            <>
              <Link to="/" className="btn ghost">Home</Link>
              <Link to="/dashboard" className="btn ghost">Dashboard</Link>
              <button className="btn primary" onClick={handleLogout}>
                Logout
              </button>
            </>
          ) : (
            <Link to="/signup" className="btn primary">Sign up</Link>
          )}
        </nav>
      </div>
    </header>
  )
}

export default Header

