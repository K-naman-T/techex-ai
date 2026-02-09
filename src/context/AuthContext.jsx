import { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [session, setSession] = useState(null);
    const [config, setConfig] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // (TEMPORARILY BYPASSED) Hardcoded guest session
        const guestUser = {
            id: "guest-user",
            email: "guest@example.com",
            user_metadata: { full_name: "Guest User" }
        };
        const guestSession = {
            user: guestUser,
            access_token: "guest-token"
        };

        setSession(guestSession);
        setUser(guestUser);
        loadUserConfigLocal(guestUser.id, "guest-token");
        setLoading(false);
    }, []);

    const loadUserConfigLocal = async (userId, manualToken) => {
        try {
            const token = manualToken || (await supabase.auth.getSession()).data.session?.access_token || "guest-token";
            const res = await fetch('/api/user/config', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (res.ok) setConfig(data);
        } catch (e) {
            console.error("Failed to load user config", e);
        }
    };

    const login = async (email, password) => {
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });
        if (error) throw error;
        return data;
    };

    const signup = async (email, password, name) => {
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: { full_name: name }
            }
        });
        if (error) throw error;
        return data;
    };

    const logout = async () => {
        await supabase.auth.signOut();
        setUser(null);
        setSession(null);
        setConfig(null);
    };

    const updateConfig = async (newConfig) => {
        // Optimistic update
        setConfig(prev => ({ ...prev, ...newConfig }));
        try {
            const token = session?.access_token;
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
        <AuthContext.Provider value={{ user, session, token: session?.access_token, config, login, signup, logout, updateConfig, loading }}>
            {children}
        </AuthContext.Provider>
    );
};
