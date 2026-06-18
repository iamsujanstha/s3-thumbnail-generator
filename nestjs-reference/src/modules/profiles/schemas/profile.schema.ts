import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ProfileDocument = Profile & Document;

@Schema({ timestamps: true })
export class Profile {
  @Prop({ required: true, trim: true })
  fullName: string;

  @Prop({ required: true, trim: true })
  jobTitle: string;

  @Prop({ required: true, trim: true })
  company: string;

  @Prop({ required: true, trim: true })
  imageKey: string;
}

export const ProfileSchema = SchemaFactory.createForClass(Profile);
