import mongoose from 'mongoose';

const zoneSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  polygon: {
    type: {
      type: String,
      enum: ['Polygon'],
      default: 'Polygon',
      required: true
    },
    coordinates: {
      type: [[[Number]]], // array of rings, each ring array of [lng, lat]
      required: true
    }
  },
  centroid: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point',
      required: true
    },
    coordinates: {
      type: [Number], // [lng, lat]
      required: true
    }
  },
  riskLevel: {
    type: String,
    enum: ['LOW', 'MEDIUM', 'HIGH', 'SEVERE'],
    default: 'LOW'
  },
  riskReason: {
    type: String,
    default: ''
  },
  estimatedPopulation: {
    type: Number,
    default: 0
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

zoneSchema.index({ centroid: '2dsphere' });
zoneSchema.index({ polygon: '2dsphere' });

export default mongoose.model('Zone', zoneSchema);
