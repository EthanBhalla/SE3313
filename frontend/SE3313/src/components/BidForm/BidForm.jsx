import React, { useState } from 'react'
import './BidForm.css' // Add this line for custom styling

export default function BidForm({ itemId, ws }) {
    const [amount, setAmount] = useState('')
    const [user, setUser] = useState('')

    const handleSubmit = (e) => {
        e.preventDefault()

        if (!ws || ws.readyState !== WebSocket.OPEN) {
            alert('WebSocket connection not open!')
            return
        }

        const bid = {
            itemId,
            amount: parseFloat(amount),
            user: user.trim()
        }

        if (!bid.user || isNaN(bid.amount)) {
            alert("Please enter valid user name and bid amount.")
            return
        }

        ws.send(JSON.stringify(bid))
        setAmount('')
        setUser('')
    }

    return (
        <form className="bid-form" onSubmit={handleSubmit}>
            <input
                type="text"
                placeholder="Your Name"
                value={user}
                onChange={(e) => setUser(e.target.value)}
                required
            />
            <input
                type="number"
                placeholder="Your Bid"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
            />
            <button type="submit">Submit Bid</button>
        </form>
    )
}
