import mongoose from 'mongoose';

const placeSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  kind: {
    type: String,
    enum: ['SHELTER', 'FOOD', 'MEDICAL'],
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
  capacity: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['OPEN', 'FULL', 'CLOSED'],
    default: 'OPEN'
  }
});

placeSchema.index({ location: '2dsphere' });

export default mongoose.model('Place', placeSchema);
