import React, { useState } from 'react'
import BidForm from '../BidForm/BidForm'
import './AuctionItem.css' // Add this line for custom styling

export default function AuctionItem({ item, ws }) {
    const [showForm, setShowForm] = useState(false)

    const toggleForm = () => setShowForm(prev => !prev)

    return (
        <div className="auction-item">
            <h3>{item.name}</h3>
            <p>{item.description || "No description"}</p>
            <p><strong>Current Bid:</strong> ${item.currentBid}</p>
            <p><strong>Highest Bidder:</strong> {item.highestBidder || 'No bids yet'}</p>
            <button onClick={toggleForm}>
                {showForm ? 'Hide Bid Form' : 'Place a Bid'}
            </button>
            {showForm && <BidForm itemId={item.id} ws={ws} />}
        </div>
    )
}
