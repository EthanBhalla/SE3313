import React, { useState, useEffect } from 'react';
import { Routes, Route, Link, Navigate, useNavigate } from 'react-router-dom';
import Home from './pages/Home/Home';
import Login from './pages/Login/Login';
import Register from './pages/Register/Register';

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
  const navigate = useNavigate();

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

  return (
    <div className="p-4">
      <header className="mb-6 flex justify-between items-center">
        <h1 className="text-2xl font-bold">Auction House</h1>
        <nav>
          {isAuthenticated ? (
            <>
              <Link to="/home" className="text-blue-500 mr-4">Home</Link>
              <button
                onClick={handleLogout}
                className="text-red-500"
              >
                Logout
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="text-blue-500 mr-4">Login</Link>
              <Link to="/register" className="text-blue-500">Register</Link>
            </>
          )}
        </nav>
      </header>
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
    </div>
  );
}

export default App;