const { MongoClient } = require('mongodb');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const uri = process.env.MONGODB_URI;
const JWT_SECRET = process.env.JWT_SECRET || 'clawcrypt-secret-key-change-in-production';

module.exports = async function handler(req, res) {
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

    const { username, password } = req.body;

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
            { userId: user._id, username: user.username },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        return res.status(200).json({ 
            success: true, 
            token,
            user: { 
                id: user._id, 
                username: user.username
            } 
        });

    } catch (error) {
        console.error('Login error:', error);
        return res.status(500).json({ error: 'Server error. Please try again.' });
    } finally {
        if (client) await client.close();
    }
}
