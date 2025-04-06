import React, { useEffect, useState } from 'react';
import AuctionItem from '../components/AuctionItem/AuctionItem';
import { BiSearch } from 'react-icons/bi';

export default function Home() {
    const [items, setItems] = useState([]);
    const [filteredItems, setFilteredItems] = useState([]);
    const [ws, setWs] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [sortBy, setSortBy] = useState('endingSoon');

    useEffect(() => {
        setLoading(true);
        fetch('http://localhost:8080/auctions')
            .then(res => {
                if (!res.ok) throw new Error('Failed to fetch auctions');
                return res.json();
            })
            .then(data => {
                setItems(data);
                setFilteredItems(data);
                setLoading(false);
            })
            .catch(err => {
                setError(err.message);
                setLoading(false);
            });

        const socket = new WebSocket('ws://localhost:8080/ws');
        socket.onmessage = (event) => {
            const updatedItem = JSON.parse(event.data);
            setItems((prevItems) =>
                prevItems.map((item) =>
                    item.id === updatedItem.id ? updatedItem : item
                )
            );
            setFilteredItems((prevItems) =>
                prevItems.map((item) =>
                    item.id === updatedItem.id ? updatedItem : item
                )
            );
        };

        setWs(socket);

        return () => socket.close();
    }, []);

    useEffect(() => {
        // Filter items based on search term
        const filtered = items.filter(item =>
            item.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.description?.toLowerCase().includes(searchTerm.toLowerCase())
        );

        // Sort items
        const sorted = [...filtered].sort((a, b) => {
            if (sortBy === 'endingSoon') {
                return new Date(a.endTime) - new Date(b.endTime);
            } else if (sortBy === 'highestBid') {
                return b.currentBid - a.currentBid;
            } else if (sortBy === 'lowestBid') {
                return a.currentBid - b.currentBid;
            }
            return 0;
        });

        setFilteredItems(sorted);
    }, [searchTerm, sortBy, items]);

    const handleSearch = (e) => {
        setSearchTerm(e.target.value);
    };

    const handleSortChange = (e) => {
        setSortBy(e.target.value);
    };

    if (error) {
        return (
            <div className="min-h-screen bg-gray-50 px-4 py-12">
                <div className="max-w-7xl mx-auto">
                    <div className="text-center p-12 bg-white rounded-lg shadow-md">
                        <h2 className="text-2xl font-bold text-red-600 mb-4">Error Loading Auctions</h2>
                        <p className="text-gray-600">{error}</p>
                        <button
                            className="mt-6 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                            onClick={() => window.location.reload()}
                        >
                            Try Again
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Hero Section */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white py-12 px-4">
                <div className="max-w-7xl mx-auto">
                    <h1 className="text-4xl md:text-5xl font-bold mb-4">Online Auction House</h1>
                    <p className="text-xl md:text-2xl opacity-90 max-w-3xl">
                        Discover unique items and place your bids in real-time. All auctions update live!
                    </p>
                </div>
            </div>

            {/* Main Content */}
            <div className="max-w-7xl mx-auto px-4 py-8">
                {/* Search and Filter Controls */}
                <div className="bg-white p-4 rounded-lg shadow-md mb-8">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <div className="relative flex-1">
                            <BiSearch className="absolute left-3 top-3 text-gray-400" size={20} />
                            <input
                                type="text"
                                placeholder="Search auctions..."
                                className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                                value={searchTerm}
                                onChange={handleSearch}
                            />
                        </div>
                        <div className="flex items-center">
                            <label htmlFor="sort" className="mr-2 text-gray-700 whitespace-nowrap">Sort by:</label>
                            <select
                                id="sort"
                                className="border border-gray-300 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                                value={sortBy}
                                onChange={handleSortChange}
                            >
                                <option value="endingSoon">Ending Soon</option>
                                <option value="highestBid">Highest Bid</option>
                                <option value="lowestBid">Lowest Bid</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Auctions Heading */}
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-bold text-gray-800">Live Auctions</h2>
                    <span className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                        {filteredItems.length} {filteredItems.length === 1 ? 'item' : 'items'}
                    </span>
                </div>

                {/* Loading State */}
                {loading ? (
                    <div className="flex justify-center items-center py-20">
                        <div className="w-12 h-12 rounded-full border-4 border-blue-200 border-t-blue-600 animate-spin"></div>
                    </div>
                ) : filteredItems.length === 0 ? (
                    // Empty State
                    <div className="bg-white rounded-lg shadow-md p-12 text-center">
                        <img
                            src="https://illustrations.popsy.co/amber/no-results-found.svg"
                            alt="No items found"
                            className="w-64 h-64 mx-auto mb-6"
                        />
                        <h3 className="text-xl font-semibold text-gray-800 mb-2">No auctions found</h3>
                        <p className="text-gray-600 mb-6">
                            {searchTerm ? "Try adjusting your search or filters." : "There are no active auctions at the moment."}
                        </p>
                        {searchTerm && (
                            <button
                                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                                onClick={() => setSearchTerm('')}
                            >
                                Clear Search
                            </button>
                        )}
                    </div>
                ) : (
                    // Auction Items Grid
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredItems.map(item => (
                            <AuctionItem key={item.id} item={item} ws={ws} />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}