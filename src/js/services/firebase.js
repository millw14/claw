// Firebase Configuration and Auth Service
import { initializeApp } from 'firebase/app';
import { getAnalytics } from 'firebase/analytics';
import { 
    getAuth, 
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signInWithPopup,
    GoogleAuthProvider,
    signOut,
    onAuthStateChanged,
    updateProfile
} from 'firebase/auth';

// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyCHV_9JlanTJzkgCsvCmhQu-qDfdX3TBhk",
    authDomain: "claw-c7170.firebaseapp.com",
    projectId: "claw-c7170",
    storageBucket: "claw-c7170.firebasestorage.app",
    messagingSenderId: "55431541057",
    appId: "1:55431541057:web:f090032d067d91b603f1c0",
    measurementId: "G-CS3565ZHKF"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

export class AuthService {
    static currentUser = null;

    // Initialize auth state listener
    static init(callback) {
        onAuthStateChanged(auth, (user) => {
            AuthService.currentUser = user;
            if (callback) callback(user);
        });
    }

    // Sign up with email and password
    static async signUp(email, password, displayName) {
        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            
            // Update display name
            if (displayName) {
                await updateProfile(userCredential.user, { displayName });
            }
            
            return { success: true, user: userCredential.user };
        } catch (error) {
            return { success: false, error: AuthService.getErrorMessage(error.code) };
        }
    }

    // Sign in with email and password
    static async signIn(email, password) {
        try {
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            return { success: true, user: userCredential.user };
        } catch (error) {
            return { success: false, error: AuthService.getErrorMessage(error.code) };
        }
    }

    // Sign in with Google
    static async signInWithGoogle() {
        try {
            const result = await signInWithPopup(auth, googleProvider);
            return { success: true, user: result.user };
        } catch (error) {
            return { success: false, error: AuthService.getErrorMessage(error.code) };
        }
    }

    // Sign out
    static async signOut() {
        try {
            await signOut(auth);
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // Check if user is authenticated
    static isAuthenticated() {
        return !!auth.currentUser;
    }

    // Get current user
    static getUser() {
        return auth.currentUser;
    }

    // Get user display name or email
    static getUserDisplayName() {
        const user = auth.currentUser;
        if (!user) return 'Guest';
        return user.displayName || user.email?.split('@')[0] || 'User';
    }

    // Convert Firebase error codes to user-friendly messages
    static getErrorMessage(code) {
        const errors = {
            'auth/email-already-in-use': 'This email is already registered',
            'auth/invalid-email': 'Invalid email address',
            'auth/operation-not-allowed': 'Operation not allowed',
            'auth/weak-password': 'Password is too weak (min 6 characters)',
            'auth/user-disabled': 'This account has been disabled',
            'auth/user-not-found': 'No account found with this email',
            'auth/wrong-password': 'Incorrect password',
            'auth/invalid-credential': 'Invalid email or password',
            'auth/too-many-requests': 'Too many attempts. Please try again later',
            'auth/popup-closed-by-user': 'Sign in was cancelled',
            'auth/network-request-failed': 'Network error. Please check your connection'
        };
        return errors[code] || 'An error occurred. Please try again';
    }
}

export { auth, analytics };
