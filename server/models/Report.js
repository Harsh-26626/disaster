import mongoose from 'mongoose';

const rescueSchema = new mongoose.Schema({
  peopleCount: {
    type: Number,
    default: 1
  },
  hasChildrenOrElderly: {
    type: Boolean,
    default: false
  },
  medicalEmergency: {
    type: Boolean,
    default: false
  },
  trapped: {
    type: Boolean,
    default: false
  },
  floorInfo: {
    type: String,
    default: ''
  }
}, { _id: false });

const reportSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['FLOODED_ROAD', 'BLOCKED_ROUTE', 'SHELTER_FULL', 'RESCUE'],
    required: true
  },
  description: {
    type: String,
    required: true
  },
  location: {
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
  status: {
    type: String,
    enum: ['UNVERIFIED', 'LIKELY', 'VERIFIED', 'RESOLVED'],
    default: 'UNVERIFIED'
  },
  priority: {
    type: Number,
    default: null
  },
  rescue: {
    type: rescueSchema,
    default: () => ({})
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

reportSchema.index({ location: '2dsphere' });

export default mongoose.model('Report', reportSchema);
