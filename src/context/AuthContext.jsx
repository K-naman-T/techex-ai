import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Load from localStorage
        const localUser = localStorage.getItem('techex_user');
        if (localUser) {
            setUser(JSON.parse(localUser));
        }
        setLoading(false);
    }, []);

    const login = (userData) => {
        setUser(userData);
        localStorage.setItem('techex_user', JSON.stringify(userData));
    };

    const logout = () => {
        localStorage.removeItem('techex_user');
        // Keep history? User said "we can't store any user data", 
        // so maybe logout should clear everything.
        localStorage.removeItem('techex_history');
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ user, login, logout, loading }}>
            {children}
        </AuthContext.Provider>
    );
};
