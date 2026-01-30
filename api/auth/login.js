import { MongoClient } from 'mongodb';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

export default async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // Check environment variables
    const uri = process.env.MONGODB_URI;
    const JWT_SECRET = process.env.JWT_SECRET;
    
    if (!uri) {
        console.error('MONGODB_URI not set');
        return res.status(500).json({ error: 'Database configuration error' });
    }
    
    if (!JWT_SECRET) {
        console.error('JWT_SECRET not set');
        return res.status(500).json({ error: 'Auth configuration error' });
    }

    const { username, password } = req.body || {};

    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required' });
    }

    let client;
    try {
        client = new MongoClient(uri);
        await client.connect();
        
        const db = client.db('clawcrypt');
        const users = db.collection('users');

        // Find user by username
        const user = await users.findOne({ username });
        
        if (!user) {
            return res.status(401).json({ error: 'Invalid username or password' });
        }

        // Check password
        const isValid = await bcrypt.compare(password, user.password);
        
        if (!isValid) {
            return res.status(401).json({ error: 'Invalid username or password' });
        }

        // Generate JWT token
        const token = jwt.sign(
            { userId: user._id.toString(), username: user.username },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        return res.status(200).json({ 
            success: true, 
            token,
            user: { 
                id: user._id.toString(), 
                username: user.username
            } 
        });

    } catch (error) {
        console.error('Login error:', error.message);
        return res.status(500).json({ error: 'Server error: ' + error.message });
    } finally {
        if (client) {
            try {
                await client.close();
            } catch (e) {
                console.error('Error closing connection:', e);
            }
        }
    }
}
