import mongoose from 'mongoose';

const feedItemSchema = new mongoose.Schema({
  source: {
    type: String,
    required: true
  },
  zone: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Zone',
    default: null
  },
  severity: {
    type: String,
    default: 'INFO'
  },
  summary: {
    type: String,
    required: true
  },
  raw: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  fetchedAt: {
    type: Date,
    default: Date.now
  }
});

feedItemSchema.index({ fetchedAt: -1 });

export default mongoose.model('FeedItem', feedItemSchema);
