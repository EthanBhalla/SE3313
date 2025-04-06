import React from 'react'
import { Routes, Route, Link } from 'react-router-dom'
import Home from './pages/Home'

function App() {
  return (
    <div className="p-4">
      <header className="mb-6 flex justify-between items-center">
        <h1 className="text-2xl font-bold">Auction House</h1>
        <nav>
          <Link to="/" className="text-blue-500">Home</Link>
        </nav>
      </header>
      <Routes>
        <Route path="/" element={<Home />} />
        {/* You can later add item pages like: <Route path="/item/:id" element={<ItemDetail />} /> */}
      </Routes>
    </div>
  )
}

export default App;