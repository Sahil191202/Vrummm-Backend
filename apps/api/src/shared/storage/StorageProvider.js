// Abstract interface. Any storage provider must implement these three methods.
// This is documentation-by-convention in JavaScript — no runtime enforcement.
//
// uploadDocument({ buffer, mimetype, originalName, folder }) → { publicId, resourceType, bytes, format }
// getSignedUrl({ publicId, resourceType, ttlSeconds })       → string (URL)
// deleteDocument({ publicId, resourceType })                 → void

export class StorageProvider {
  async uploadDocument(_opts) {
    throw new Error('StorageProvider.uploadDocument is not implemented');
  }

  async getSignedUrl(_opts) {
    throw new Error('StorageProvider.getSignedUrl is not implemented');
  }

  async deleteDocument(_opts) {
    throw new Error('StorageProvider.deleteDocument is not implemented');
  }
}
