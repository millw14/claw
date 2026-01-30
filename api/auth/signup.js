const { MongoClient } = require('mongodb');
const bcrypt = require('bcryptjs');

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

    // Check environment variable
    const uri = process.env.MONGODB_URI;
    if (!uri) {
        console.error('MONGODB_URI not set');
        return res.status(500).json({ error: 'Database configuration error' });
    }

    const { username, password } = req.body || {};

    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required' });
    }

    if (username.length < 3) {
        return res.status(400).json({ error: 'Username must be at least 3 characters' });
    }

    if (password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    let client;
    try {
        client = new MongoClient(uri);
        await client.connect();
        
        const db = client.db('clawcrypt');
        const users = db.collection('users');

        // Check if username exists
        const existingUser = await users.findOne({ username });
        
        if (existingUser) {
            return res.status(400).json({ error: 'Username already taken' });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create user
        const result = await users.insertOne({
            username,
            password: hashedPassword,
            createdAt: new Date()
        });

        return res.status(201).json({ 
            success: true, 
            user: { 
                id: result.insertedId.toString(), 
                username
            } 
        });

    } catch (error) {
        console.error('Signup error:', error.message);
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
};
