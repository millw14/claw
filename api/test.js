module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    const hasMongoUri = !!process.env.MONGODB_URI;
    const hasJwtSecret = !!process.env.JWT_SECRET;
    
    // Test MongoDB connection
    let mongoStatus = 'not tested';
    if (hasMongoUri) {
        try {
            const { MongoClient } = require('mongodb');
            const client = new MongoClient(process.env.MONGODB_URI);
            await client.connect();
            await client.db('clawcrypt').command({ ping: 1 });
            await client.close();
            mongoStatus = 'connected';
        } catch (error) {
            mongoStatus = 'error: ' + error.message;
        }
    }
    
    return res.status(200).json({
        envVars: {
            MONGODB_URI: hasMongoUri ? 'set' : 'NOT SET',
            JWT_SECRET: hasJwtSecret ? 'set' : 'NOT SET'
        },
        mongoStatus
    });
};
