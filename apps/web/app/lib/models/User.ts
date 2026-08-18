import { Schema, model } from 'mongoose';

const UserSchema = new Schema(
  {
    email: { type: String, unique: true, sparse: true },
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    picture: { type: String },
    provider: { type: String, required: true, enum: ['github'] },
    providerId: { type: String, required: true, unique: true },
  },
  { timestamps: true }
);

export default model('User', UserSchema);
