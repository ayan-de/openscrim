import { Schema, model } from 'mongoose';

const UserSchema = new Schema(
  {
    email: { type: String, required: true, unique: true },
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    picture: { type: String },
    provider: { type: String, required: true },
    providerId: { type: String, required: true, unique: true },
  },
  { timestamps: true }
);

export default model('User', UserSchema);
