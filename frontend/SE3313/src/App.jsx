import React, { useState, useEffect } from 'react';
import { Routes, Route, Link, Navigate, useNavigate } from 'react-router-dom';
import Home from './pages/Home/Home';
import Login from './pages/Login/Login';
import Register from './pages/Register/Register';
import AuctionCenter from './pages/AuctionCenter/AuctionCenter';
import AuctionItem from './components/AuctionItem/AuctionItem'; // Import your existing AuctionItem component
import MyAuctions from './pages/MyAuctions/MyAuctions';
import NewListing from './components/NewListing/NewListing';
import './App.css';

// Protected Route component
const ProtectedRoute = ({ children }) => {
  const token = localStorage.getItem('token');

  if (!token) {
    // Redirect to login if no token exists
    return <Navigate to="/login" replace />;
  }

  return children;
};

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const navigate = useNavigate();
  const username = localStorage.getItem('username');

  // Check authentication status when component mounts
  useEffect(() => {
    const token = localStorage.getItem('token');
    setIsAuthenticated(!!token);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    setIsAuthenticated(false);
    navigate('/login');
  };

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  return (
    <div className="app-container">
      <header className="navbar">
        <div className="navbar-container">
          <div className="navbar-logo">
            <Link to="/" className="logo-link">
              <span className="logo-text">Auction House</span>
            </Link>
          </div>

          {/* Mobile menu button */}
          <button
            className="mobile-menu-button"
            onClick={toggleMobileMenu}
            aria-label="Toggle menu"
          >
            <span className="menu-bar"></span>
            <span className="menu-bar"></span>
            <span className="menu-bar"></span>
          </button>

          {/* Navigation links */}
          <nav className={`navbar-links ${isMobileMenuOpen ? 'active' : ''}`}>
            {isAuthenticated ? (
              <>
                <Link to="/home" className="nav-link">Home</Link>
                <Link to="/AuctionCenter" className="nav-link">Auctions</Link>
                <Link to="/MyAuctions" className="nav-link">My Auctions</Link>
                <div className="user-profile">
                  <span className="username">{username || 'User'}</span>
                  <button
                    onClick={handleLogout}
                    className="logout-button"
                  >
                    Logout
                  </button>
                </div>
              </>
            ) : (
              <>
                <Link to="/login" className="nav-link">Login</Link>
                <Link to="/register" className="nav-link">Register</Link>
              </>
            )}
          </nav>
        </div>
      </header>

      <main className="main-content">
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<Login setIsAuthenticated={setIsAuthenticated} />} />
          <Route path="/register" element={<Register />} />

          {/* Protected routes */}
          <Route
            path="/home"
            element={
              <ProtectedRoute>
                <Home />
              </ProtectedRoute>
            }
          />
          <Route
            path="/AuctionCenter"
            element={
              <ProtectedRoute>
                <AuctionCenter />
              </ProtectedRoute>
            }
          />
          <Route
            path="/auction/:id"
            element={
              <ProtectedRoute>
                <AuctionItem />
              </ProtectedRoute>
            }
          />
          <Route
            path="/MyAuctions"
            element={
              <ProtectedRoute>
               <MyAuctions/>
              </ProtectedRoute>
            }
          />
          <Route
            path="/NewListing"
            element={
              <ProtectedRoute>
               <NewListing/>
              </ProtectedRoute>
            }
          />

          {/* Default route - redirect based on auth status */}
          <Route
            path="/"
            element={
              isAuthenticated ?
                <Navigate to="/home" replace /> :
                <Navigate to="/login" replace />
            }
          />
        </Routes>
      </main>
    </div>
  );
}

export default App;