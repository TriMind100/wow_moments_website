const session = require('express-session');
const mongoose = require('mongoose');

class DynamicStore extends session.Store {
    constructor() {
        super();
        this.memoryStore = new session.MemoryStore();
        this.mongoStore = null;
    }

    getStore() {
        if (mongoose.connection.readyState === 1) {
            if (!this.mongoStore) {
                console.log('DynamicStore: Mongoose is connected. Lazily initializing MongoStore...');
                const { MongoStore } = require('connect-mongo');
                this.mongoStore = MongoStore.create({
                    client: mongoose.connection.getClient(),
                    collectionName: 'sessions',
                    ttl: 14 * 24 * 60 * 60
                });
                this.mongoStore.on('error', (err) => {
                    console.log('DynamicStore - MongoStore error:', err.message);
                });
            }
            return this.mongoStore;
        }
        return this.memoryStore;
    }

    get(sid, cb) {
        this.getStore().get(sid, cb);
    }

    set(sid, sess, cb) {
        this.getStore().set(sid, sess, cb);
    }

    destroy(sid, cb) {
        this.getStore().destroy(sid, cb);
    }

    touch(sid, sess, cb) {
        const store = this.getStore();
        if (store.touch) {
            store.touch(sid, sess, cb);
        } else {
            cb();
        }
    }
}

// Register connection error handler
mongoose.connection.on('error', err => {
    console.log('Mongoose connection error handler triggered:', err.message);
});

console.log('Connecting to mongoose...');
mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 500 })
    .then(() => console.log('Mongoose connection promise resolved.'))
    .catch(err => console.log('Mongoose connection promise rejected:', err.message));

const store = new DynamicStore();
console.log('DynamicStore instance created.');

// Simulate a session operation immediately
store.set('123', { cookie: {} }, (err) => {
    if (err) console.log('Initial set error:', err);
    else console.log('Initial set succeeded in active store.');
});

setTimeout(() => {
    console.log('After 1 second, active store is:', store.getStore() === store.memoryStore ? 'MemoryStore' : 'MongoStore');
    store.set('456', { cookie: {} }, (err) => {
        if (err) console.log('Timeout-safe set error:', err);
        else console.log('Timeout-safe set succeeded.');
    });
}, 1000);
