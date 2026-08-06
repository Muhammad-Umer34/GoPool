import { Provider } from '@nestjs/common';
import { v2 as cloudinary } from 'cloudinary';

export const CLOUDINARY = 'Cloudinary';

export const CloudinaryProvider: Provider = {
  provide: CLOUDINARY,
  useFactory: () => {
    return cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'dummy_cloud',
      api_key: process.env.CLOUDINARY_API_KEY || 'dummy_key',
      api_secret: process.env.CLOUDINARY_API_SECRET || 'dummy_secret',
    });
  },
};
