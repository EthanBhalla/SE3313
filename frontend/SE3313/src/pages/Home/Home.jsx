import React from 'react';
import { useNavigate } from 'react-router-dom';
import './Home.css';

export default function Home() {
    const navigate = useNavigate();
    const username = localStorage.getItem('username');

    const navigateToAllAuctions = () => {
        navigate('/AuctionCenter');
    };

    const navigateToMyAuctions = () => {
        navigate('/MyAuctions');
    };

    return (
        <div className="home-container">
            {/* Hero Section */}
            <div className="hero-section">
                <div className="hero-content">
                    <h1>Welcome to Auction House</h1>
                    <p>Discover unique items and place your bids in real-time. All auctions update live!</p>
                </div>
            </div>

            {/* Welcome Card */}
            <div className="welcome-card">
                <div className="welcome-header">
                    <h2>Hello, {username || 'User'}!</h2>
                    <p>What would you like to do today?</p>
                </div>

                <div className="action-buttons">
                    <button onClick={navigateToAllAuctions} className="action-button primary">
                        <span className="button-icon">🔍</span>
                        <span className="button-text">
                            <span className="button-title">Browse Auctions</span>
                            <span className="button-description">View all available items</span>
                        </span>
                    </button>

                    <button onClick={navigateToMyAuctions} className="action-button secondary">
                        <span className="button-icon">📦</span>
                        <span className="button-text">
                            <span className="button-title">My Auctions</span>
                            <span className="button-description">Manage your listing</span>
                        </span>
                    </button>
                </div>

                <div className="feature-cards">
                    <div className="feature-card">
                        <div className="feature-icon">⚡</div>
                        <h3>Real-time Updates</h3>
                        <p>All auction activities are updated instantly</p>
                    </div>

                    <div className="feature-card">
                        <div className="feature-icon">🔒</div>
                        <h3>Secure Bidding</h3>
                        <p>Your transactions are protected and private</p>
                    </div>

                    <div className="feature-card">
                        <div className="feature-icon">🏆</div>
                        <h3>Fair Competition</h3>
                        <p>Equal opportunity for all participants</p>
                    </div>
                </div>
            </div>
        </div>
    );
}