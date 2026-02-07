import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(localStorage.getItem('token'));
    const [config, setConfig] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Check if token exists and validate (optional: add /me endpoint to validate token)
        if (token) {
            // For now, assume decode or persisted user. Ideally fetch /me
            const savedUser = localStorage.getItem('user');
            if (savedUser) {
                try {
                    setUser(JSON.parse(savedUser));
                } catch (e) {
                    logout();
                }
            }
        }
        setLoading(false);
    }, []);

    const login = async (email, password) => {
        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);

            setToken(data.token);
            setUser(data.user);
            setConfig(data.config);

            localStorage.setItem('token', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));

            return data;
        } catch (error) {
            throw error;
        }
    };

    const signup = async (email, password, name) => {
        try {
            const res = await fetch('/api/auth/signup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password, name }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            return data;
        } catch (error) {
            throw error;
        }
    };

    const logout = () => {
        setUser(null);
        setToken(null);
        setConfig(null);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
    };

    const updateConfig = async (newConfig) => {
        // Optimistic update
        setConfig(prev => ({ ...prev, ...newConfig }));
        try {
            await fetch('/api/user/config', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(newConfig),
            });
        } catch (e) {
            console.error("Failed to save config", e);
        }
    };

    return (
        <AuthContext.Provider value={{ user, token, config, login, signup, logout, updateConfig, loading }}>
            {children}
        </AuthContext.Provider>
    );
};
