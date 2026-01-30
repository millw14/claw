// Auth Service - MongoDB-based authentication

const API_BASE = '/api/auth';

export class AuthService {
    static currentUser = null;
    static token = null;

    // Initialize from localStorage
    static init(callback) {
        const savedToken = localStorage.getItem('clawcrypt_token');
        const savedUser = localStorage.getItem('clawcrypt_user');
        
        if (savedToken && savedUser) {
            AuthService.token = savedToken;
            AuthService.currentUser = JSON.parse(savedUser);
        }
        
        if (callback) callback(AuthService.currentUser);
    }

    // Sign up with username, email and password
    static async signUp(email, password, username) {
        try {
            const response = await fetch(`${API_BASE}/signup`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, email, password })
            });

            const data = await response.json();
            
            if (!response.ok) {
                return { success: false, error: data.error };
            }

            // Auto login after signup
            return await AuthService.signIn(email, password);
        } catch (error) {
            return { success: false, error: 'Network error. Please try again.' };
        }
    }

    // Sign in with email and password
    static async signIn(email, password) {
        try {
            const response = await fetch(`${API_BASE}/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();
            
            if (!response.ok) {
                return { success: false, error: data.error };
            }

            // Save to localStorage
            AuthService.token = data.token;
            AuthService.currentUser = data.user;
            localStorage.setItem('clawcrypt_token', data.token);
            localStorage.setItem('clawcrypt_user', JSON.stringify(data.user));

            return { success: true, user: data.user };
        } catch (error) {
            return { success: false, error: 'Network error. Please try again.' };
        }
    }

    // Sign out
    static async signOut() {
        AuthService.token = null;
        AuthService.currentUser = null;
        localStorage.removeItem('clawcrypt_token');
        localStorage.removeItem('clawcrypt_user');
        return { success: true };
    }

    // Check if user is authenticated
    static isAuthenticated() {
        return !!AuthService.token && !!AuthService.currentUser;
    }

    // Get current user
    static getUser() {
        return AuthService.currentUser;
    }

    // Get user display name
    static getUserDisplayName() {
        if (!AuthService.currentUser) return 'Guest';
        return AuthService.currentUser.username || AuthService.currentUser.email?.split('@')[0] || 'User';
    }

    // Get auth token for API calls
    static getToken() {
        return AuthService.token;
    }
}
