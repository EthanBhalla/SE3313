import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import './AuctionCenter.css';

export default function AuctionCenter() {
    const [auctions, setAuctions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const token = localStorage.getItem('token');
    const username = localStorage.getItem('username');
    const navigate = useNavigate();

    useEffect(() => {
        const fetchAuctions = async () => {
            try {
                setLoading(true);

                if (!token) {
                    throw new Error('No authentication token found');
                }

                const response = await axios.get('http://localhost:8080/auctions', {
                    headers: {
                        'Authorization': token
                    }
                });

                setAuctions(response.data);
                setError(null);
            } catch (err) {
                setError('Failed to load auctions. ' + (err.response?.data || err.message));

                // If unauthorized, redirect to login
                if (err.response?.status === 403) {
                    setTimeout(() => navigate('/login'), 2000);
                }
            } finally {
                setLoading(false);
            }
        };

        fetchAuctions();
    }, [token, navigate]);

    // Get a color class based on the auction id
    const getColorClass = (id) => {
        const colors = ['blue', 'purple', 'green', 'orange', 'red'];
        return colors[id % colors.length];
    };

    if (loading) {
        return (
            <div className="loader-container">
                <div className="loader"></div>
                <p>Loading auctions...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="error-container">
                <div className="error-message">
                    <p>{error}</p>
                    <button
                        onClick={() => navigate('/login')}
                        className="error-button"
                    >
                        Return to Login
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="auction-page">
            <div className="auction-header">
                <h1>Available Auctions</h1>
                <div className="action-buttons">
                    <Link to="/create-auction" className="create-btn">
                        Create Auction
                    </Link>
                    <Link to="/home" className="home-btn">
                        Back to Home
                    </Link>
                </div>
            </div>

            {auctions.length === 0 ? (
                <div className="no-auctions">
                    <p>No auctions available at this time.</p>
                </div>
            ) : (
                <div className="auction-grid">
                    {auctions.map(auction => (
                        <div key={auction.id} className={`auction-card ${getColorClass(auction.id)}`}>
                            <div className="auction-header-banner"></div>
                            <div className="auction-content">
                                <h2>{auction.item}</h2>

                                <div className="auction-info">
                                    <div className="info-row">
                                        <span className="info-label">Starting price:</span>
                                        <span className="info-value price">
                                            ${auction.starting_price.toFixed(2)}
                                        </span>
                                    </div>

                                    <div className="info-row">
                                        <span className="info-label">Current bid:</span>
                                        <span className="info-value current-bid">
                                            ${auction.highest_bid > 0
                                                ? auction.highest_bid.toFixed(2)
                                                : auction.starting_price.toFixed(2)}
                                        </span>
                                    </div>

                                    <div className="info-row">
                                        <span className="info-label">Seller:</span>
                                        <span className="info-value seller">
                                            {auction.owner || 'Unknown'}
                                        </span>
                                    </div>
                                </div>

                                <div className="auction-footer">
                                    <div className={`bidder-status ${auction.highest_bidder === username ? 'your-bid' : ''}`}>
                                        {auction.highest_bidder === username
                                            ? "You are the highest bidder! 🎉"
                                            : auction.highest_bidder
                                                ? `Highest bidder: ${auction.highest_bidder}`
                                                : "No bids yet"}
                                    </div>
                                    <Link
                                        to={`/auction/${auction.id}`}
                                        className="view-details-btn"
                                    >
                                        View Details
                                    </Link>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}