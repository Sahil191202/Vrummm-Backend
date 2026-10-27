import { v2 as cloudinary } from 'cloudinary';
import { StorageProvider } from './StorageProvider.js';
import { errors } from '../AppError.js';

const ALLOWED_MIMETYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

export class CloudinaryStorageProvider extends StorageProvider {
  constructor({ cloudName, apiKey, apiSecret, signedUrlTtlSeconds = 300 }) {
    super();
    cloudinary.config({
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret,
      secure: true,
    });
    this._ttl = signedUrlTtlSeconds;
  }

  async uploadDocument({ buffer, mimetype, originalName, folder }) {
    if (!ALLOWED_MIMETYPES.includes(mimetype)) {
      throw errors.badRequest(
        `Unsupported file type: ${mimetype}. Allowed: JPEG, PNG, WEBP, PDF`,
      );
    }

    const base64 = buffer.toString('base64');
    const dataUri = `data:${mimetype};base64,${base64}`;

    let result;
    try {
      result = await cloudinary.uploader.upload(dataUri, {
        folder,
        resource_type: 'auto',
        use_filename: false,
        unique_filename: true,
        context: { original_name: originalName },
      });
    } catch (err) {
      throw errors.unavailable('Document upload failed', {
        detail: err.message ?? String(err),
      });
    }

    return {
      publicId: result.public_id,
      resourceType: result.resource_type,
      bytes: result.bytes,
      format: result.format,
    };
  }

  async getSignedUrl({ publicId, resourceType }) {
    return cloudinary.url(publicId, {
      resource_type: resourceType,
      type: 'upload',
      sign_url: false,
    });
  }

  async deleteDocument({ publicId, resourceType }) {
    await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType,
      type: 'upload',
      invalidate: true,
    });
  }
}