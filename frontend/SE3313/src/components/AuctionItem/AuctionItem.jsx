import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import './AuctionItem.css';

export default function AuctionItem() {
    const [auction, setAuction] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [bidAmount, setBidAmount] = useState('');
    const [bidError, setBidError] = useState('');
    const [bidSuccess, setBidSuccess] = useState('');
    const { id } = useParams();
    const token = localStorage.getItem('token');
    const username = localStorage.getItem('username');
    const navigate = useNavigate();

    useEffect(() => {
        const fetchAuctionDetails = async () => {
            try {
                setLoading(true);

                if (!token) {
                    throw new Error('No authentication token found');
                }

                const response = await axios.get(`http://localhost:8080/auction/${id}`, {
                    headers: {
                        'Authorization': token
                    }
                });

                setAuction(response.data);
                setError(null);
            } catch (err) {
                setError('Failed to load auction details. ' + (err.response?.data || err.message));

                // If unauthorized, redirect to login
                if (err.response?.status === 403) {
                    setTimeout(() => navigate('/login'), 2000);
                }
            } finally {
                setLoading(false);
            }
        };

        fetchAuctionDetails();
    }, [id, token, navigate]);

    const handlePlaceBid = async (e) => {
        e.preventDefault();
        const checkChange = await axios.get(`http://localhost:8080/auction/${id}`, {
            headers: {
                'Authorization': token
            }
        });
        setAuction(checkChange.data);

        setBidError('');
        setBidSuccess('');

        // Basic validation
        const amount = parseFloat(bidAmount);
        if (isNaN(amount) || amount <= 0) {
            setBidError('Please enter a valid bid amount.');
            return;
        }

        const currentHighestBid = auction.highest_bid > 0
            ? auction.highest_bid
            : auction.starting_price;

        if (amount <= currentHighestBid) {
            setBidError(`Your bid must be higher than the current bid: $${currentHighestBid.toFixed(2)}`);
            return;
        }

        try {
            await axios.post('http://localhost:8080/bid',
                {
                    auction_id: Number(id),
                    bidder: username,
                    bid_amount: Number(amount)
                },
                {
                    headers: {
                        'Authorization': token,
                        'Content-Type': 'application/json'
                    }
                }
            );

            setBidSuccess(`Your bid of $${amount.toFixed(2)} was placed successfully!`);
            setBidAmount('');

            // Refresh auction data to show updated bid
            const response = await axios.get(`http://localhost:8080/auction/${id}`, {
                headers: {
                    'Authorization': token
                }
            });

            setAuction(response.data);

        } catch (err) {
            setBidError('Failed to place bid: ' + (err.response?.data || err.message));
        }
    };

    if (loading) {
        return (
            <div className="loader-container">
                <div className="loader"></div>
                <p>Loading auction details...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="error-container">
                <div className="error-message">
                    <p>{error}</p>
                    <button
                        onClick={() => navigate('/AuctionCenter')}
                        className="error-button"
                    >
                        Return to Auctions
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="auction-detail-page">
            <div className="auction-detail-header">
                <button onClick={() => navigate('/AuctionCenter')} className="back-btn">
                    ← Back to Auctions
                </button>
                <h1>Auction Details</h1>
                <div></div> {/* Empty div for layout balance */}
            </div>

            <div className="auction-detail-container">
                <div className="auction-detail-card">
                    <div className="auction-detail-title">
                        <h2>{auction.item}</h2>
                    </div>

                    <div className="auction-detail-info">
                        <div className="detail-row">
                            <span className="detail-label">Starting Price:</span>
                            <span className="detail-value price">
                                ${auction.starting_price.toFixed(2)}
                            </span>
                        </div>

                        <div className="detail-row">
                            <span className="detail-label">Current Highest Bid:</span>
                            <span className="detail-value current-bid">
                                ${auction.highest_bid > 0
                                    ? auction.highest_bid.toFixed(2)
                                    : auction.starting_price.toFixed(2)}
                            </span>
                        </div>

                        <div className="detail-row">
                            <span className="detail-label">Seller:</span>
                            <span className="detail-value seller">
                                {auction.owner || 'Unknown'}
                            </span>
                        </div>

                        <div className="detail-row">
                            <span className="detail-label">Highest Bidder:</span>
                            <span className="detail-value bidder">
                                {auction.highest_bidder || 'No bids yet'}
                            </span>
                        </div>

                        {auction.owner !== username && (
                            <div className="bid-section">
                                <h3>Place Your Bid</h3>
                                {bidError && <p className="bid-error">{bidError}</p>}
                                {bidSuccess && <p className="bid-success">{bidSuccess}</p>}

                                <form onSubmit={handlePlaceBid} className="bid-form">
                                    <div className="bid-input-group">
                                        <span className="currency-symbol">$</span>
                                        <input
                                            type="number"
                                            step="0.01"
                                            className="bid-input"
                                            placeholder="Enter bid amount"
                                            value={bidAmount}
                                            onChange={(e) => setBidAmount(e.target.value)}
                                            min={auction.highest_bid > 0
                                                ? (auction.highest_bid + 0.01).toFixed(2)
                                                : (auction.starting_price + 0.01).toFixed(2)}
                                        />
                                    </div>
                                    <button type="submit" className="place-bid-btn">
                                        Place Bid
                                    </button>
                                </form>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}