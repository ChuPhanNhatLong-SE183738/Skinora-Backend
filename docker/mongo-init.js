// MongoDB initialization script
db = db.getSiblingDB('skinora');

// Create collections if they don't exist
db.createCollection('users');
db.createCollection('doctors');
db.createCollection('appointments');
db.createCollection('chat_messages');
db.createCollection('chat_history');
db.createCollection('products');
db.createCollection('categories');
db.createCollection('reviews');
db.createCollection('analysis');

// Create indexes for better performance
db.users.createIndex({ email: 1 }, { unique: true });
db.doctors.createIndex({ email: 1 }, { unique: true });
db.appointments.createIndex({ doctorId: 1, userId: 1 });
db.chat_messages.createIndex({ chatId: 1, createdAt: 1 });
db.chat_history.createIndex({ participants: 1 });
db.products.createIndex({ categoryId: 1 });
db.analysis.createIndex({ userId: 1, createdAt: -1 });

print('Database initialized successfully');
