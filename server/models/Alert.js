import mongoose from 'mongoose';

const alertSchema = new mongoose.Schema({
  zone: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Zone',
    required: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  message: {
    type: String,
    required: true,
    trim: true
  },
  severity: {
    type: String,
    enum: ['LOW', 'MEDIUM', 'HIGH', 'SEVERE'],
    default: 'HIGH'
  },
  status: {
    type: String,
    enum: ['DRAFT', 'SENT'],
    default: 'DRAFT'
  },
  source: {
    type: String,
    enum: ['OPEN_METEO', 'GDACS', 'SACHET', 'MANUAL'],
    default: 'MANUAL'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  sentAt: {
    type: Date,
    default: null
  }
});

alertSchema.index({ status: 1, sentAt: -1, createdAt: -1 });

export default mongoose.model('Alert', alertSchema);
