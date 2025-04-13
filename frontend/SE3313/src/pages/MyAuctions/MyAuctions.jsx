import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import './MyAuctions.css';

export default function MyAuctions() {
    const [auctions, setAuctions] = useState([]);
    const [filteredAuctions, setFilteredAuctions] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
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

                const response = await axios.get(`http://localhost:8080/auctionsByUser/${username}`, {
                    headers: {
                        'Authorization': token
                    }
                });

                setAuctions(response.data);
                setFilteredAuctions(response.data);
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

    // Handle search functionality
    useEffect(() => {
        if (searchTerm.trim() === '') {
            setFilteredAuctions(auctions);
        } else {
            const filtered = auctions.filter(auction =>
                auction.item.toLowerCase().includes(searchTerm.toLowerCase()) ||
                auction.owner?.toLowerCase().includes(searchTerm.toLowerCase())
            );
            setFilteredAuctions(filtered);
        }
    }, [searchTerm, auctions]);

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
                <button onClick={() => navigate('/home')} className="back-btn">
                    ← Back
                </button>
                <h1>My Auctions</h1>
                <div className="action-buttons">
            <Link to={`/NewListing`} className="create-btn">
                Create Listing
            </Link>
                </div>
            </div>

            {filteredAuctions.length === 0 ? (
                <div className="no-auctions">
                    {searchTerm ? (
                        <p>No auctions match your search for "{searchTerm}".</p>
                    ) : (
                        <p>No auctions available at this time.</p>
                    )}
                </div>
            ) : (
                <div className="auction-grid">
                    {filteredAuctions.map(auction => (
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
                                        <span className="info-label">End Date:</span>
                                        <span className="info-value seller">
                                            {auction.end_datetime || 'Unknown'}
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
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}