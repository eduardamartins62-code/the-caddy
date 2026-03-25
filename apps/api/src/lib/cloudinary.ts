import { v2 as cloudinary } from 'cloudinary';
import multer from 'multer';
import { CloudinaryStorage } from 'multer-storage-cloudinary';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'the-caddy',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'mp4', 'mov'],
    resource_type: 'auto',
  } as Record<string, unknown>,
});

export const upload = multer({ storage });
export default cloudinary;
