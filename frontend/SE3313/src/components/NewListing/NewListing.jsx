import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import './NewListing.css';

export default function NewListing() {
    const [startingPrice, setStartingPrice] = useState(0);
    const [itemName, setItemName] = useState('');
    const [endDate, setEndDate] = useState('');
    const token = localStorage.getItem('token');
    const username = localStorage.getItem('username');
    const navigate = useNavigate();

    const handleCreate = async (e) => {
        e.preventDefault();
        if( itemName == '' || endDate == ''){
            alert("Fill in all fields");
        }
        else{
        const selectedDateTime = new Date(endDate);
        const formattedDateTime = selectedDateTime
            .toISOString()
            .slice(0, 19)
            .replace('T', ' '); // "YYYY-MM-DD HH:MM:SS"
        try {
            await axios.post('http://localhost:8080/create_auction',
                {
                    item: itemName,
                    starting_price: startingPrice,
                    end_datetime: formattedDateTime,
                    username: username
                },
                {
                    headers: {
                        'Authorization': token,
                        'Content-Type': 'application/json'
                    }
                }
            );
            navigate('/MyAuctions')
        } catch (err) {
            console.log(err)
        }
    }
    };

    return (
        <div className="auction-detail-page">
            <div className="auction-detail-header">
                <button onClick={() => navigate('/MyAuctions')} className="back-btn">
                    ← Back to My Auctions
                </button>
                <div></div> {/* Empty div for layout balance */}
            </div>

            <div className="auction-detail-container">
                <div className="auction-detail-card">
                    <div className="auction-detail-info">
                    <h1>Create New Listing</h1>
                            <div className="bid-section">
                                
                                <form onSubmit={handleCreate} className="bid-form">
                                <h3>Item Name</h3>
                                <div className="bid-input-group">
                                        <input
                                            type="text"
                                            className="bid-input"
                                            placeholder="Enter Item Name"
                                            value={itemName}
                                            onChange={(e) => setItemName(e.target.value)}
                                        />
                                    </div>
                                    <h3>Starting Price</h3>
                                    <div className="bid-input-group">
                                        <span className="currency-symbol">$</span>
                                        <input
                                            type="number"
                                            step="0.01"
                                            className="bid-input"
                                            placeholder="Enter Starting Price"
                                            value={startingPrice}
                                            onChange={(e) => setStartingPrice(parseFloat(e.target.value))}
                                        />
                                    </div>
                                    <h3>End Date</h3>
                                    <div className="bid-input-group">
                                        <input
                                            type="datetime-local"
                                            className="bid-input"
                                            value={endDate}
                                            onChange={(e) => {
                                                setEndDate(e.target.value); // keep raw value like "2025-04-24T05:29"
                                            }}
                                        />
                                    </div>
                                    <button type="submit" className="place-bid-btn"> Create </button>
                                </form>
                            </div>
                    </div>
                </div>
            </div>
        </div>
    );
}