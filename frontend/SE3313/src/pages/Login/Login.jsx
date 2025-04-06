import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import './Login.css';

const Login = ({ setIsAuthenticated }) => {
    const [formData, setFormData] = useState({
        username: '',
        password: '',
    });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    // Test localStorage on component mount
    useEffect(() => {
        try {
            const testKey = '_test_storage_' + Date.now();
            localStorage.setItem(testKey, 'test');
            const testResult = localStorage.getItem(testKey);
            localStorage.removeItem(testKey);


        } catch (e) {
            throw new Error('Error accessing localStorage: ' + e.message);
        }
    }, []);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData({
            ...formData,
            [name]: value,
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const response = await axios.post('http://localhost:8080/login', formData);

            // Extract just the JWT token from the response
            let fullResponse = response.data;
            let jwtToken = '';

            // Check if response contains "Login successful. Token: "
            if (typeof fullResponse === 'string' && fullResponse.includes('Token:')) {
                // Extract everything after "Token: "
                const tokenMatch = fullResponse.match(/Token:\s*(.*)/);
                if (tokenMatch && tokenMatch[1]) {
                    jwtToken = tokenMatch[1].trim();
                } else {
                    throw new Error('Invalid token format received from server');
                }
            } else {
                jwtToken = fullResponse;
            }

            // Store the clean JWT token and username
            localStorage.setItem('token', jwtToken);
            localStorage.setItem('username', formData.username);

            // Update authentication state
            if (setIsAuthenticated) {
                setIsAuthenticated(true);
            }

            // Navigate to home page
            navigate('/home');
        } catch (err) {
            setError(
                err.response?.data?.message ||
                'Login failed. Please check your credentials and try again.'
            );
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-container">
            <div className="login-card">
                <h2>Log In to Your Account</h2>



                {error && <div className="error-message">{error}</div>}

                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label htmlFor="username">Username</label>
                        <input
                            type="text"
                            id="username"
                            name="username"
                            value={formData.username}
                            onChange={handleChange}
                            required
                            placeholder="Enter your username"
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="password">Password</label>
                        <input
                            type="password"
                            id="password"
                            name="password"
                            value={formData.password}
                            onChange={handleChange}
                            required
                            placeholder="Enter your password"
                        />
                    </div>

                    <button
                        type="submit"
                        className="login-button"
                        disabled={loading}
                    >
                        {loading ? 'Logging in...' : 'Log In'}
                    </button>
                </form>

                <div className="login-footer">
                    <p>Don't have an account? <Link to="/register">Register</Link></p>
                </div>
            </div>
        </div>
    );
};

export default Login;