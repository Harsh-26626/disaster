import mongoose from 'mongoose';

export async function connectDB() {
  const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/disaster_db';
  try {
    await mongoose.connect(uri);
    console.log(`[Database] MongoDB connected successfully to ${uri.replace(/\/\/[^:]+:[^@]+@/, '//***:***@')}`);
  } catch (error) {
    console.error('[Database] MongoDB connection error:', error.message);
    throw error;
  }
}
