import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IGalaxyAddressBookEntry extends Document {
  session_id: string;
  ownerCharacterId: string;
  contactCharacterId: string;
  contactName: string;
  createdAt?: Date;
  updatedAt?: Date;
}

const GalaxyAddressBookSchema = new Schema<IGalaxyAddressBookEntry>(
  {
    session_id: { type: String, required: true, index: true },
    ownerCharacterId: { type: String, required: true },
    contactCharacterId: { type: String, required: true },
    contactName: { type: String, required: true },
  },
  {
    timestamps: true,
  }
);

GalaxyAddressBookSchema.index(
  { session_id: 1, ownerCharacterId: 1, contactCharacterId: 1 },
  { unique: true }
);

export const GalaxyAddressBookEntry =
  (mongoose.models.GalaxyAddressBookEntry as Model<IGalaxyAddressBookEntry> | undefined) || mongoose.model<IGalaxyAddressBookEntry>('GalaxyAddressBookEntry', GalaxyAddressBookSchema);
