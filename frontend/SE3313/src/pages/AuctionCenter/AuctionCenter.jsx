import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import './AuctionCenter.css';

export default function AuctionCenter() {
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

                const response = await axios.get('http://localhost:8080/auctions', {
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
                <h1>Available Auctions</h1>
                <div className="action-buttons">
                    {/* Empty div to maintain layout */}
                </div>
            </div>

            <div className="search-container">
                <div className="search-wrapper">
                    <svg className="search-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="11" cy="11" r="8"></circle>
                        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                    </svg>
                    <input
                        type="text"
                        className="search-input"
                        placeholder="Search auctions by item or seller..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    {searchTerm && (
                        <button
                            className="clear-search"
                            onClick={() => setSearchTerm('')}
                        >
                            ×
                        </button>
                    )}
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