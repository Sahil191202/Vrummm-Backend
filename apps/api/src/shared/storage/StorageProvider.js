// Abstract interface. Any storage provider must implement these three methods.
// This is documentation-by-convention in JavaScript — no runtime enforcement.
//
// uploadDocument({ buffer, mimetype, originalName, folder }) → { publicId, resourceType, bytes, format }
// getSignedUrl({ publicId, resourceType, ttlSeconds })       → string (URL)
// deleteDocument({ publicId, resourceType })                 → void

export class StorageProvider {
  // eslint-disable-next-line no-unused-vars
  async uploadDocument(_opts) {
    throw new Error('StorageProvider.uploadDocument is not implemented');
  }

  // eslint-disable-next-line no-unused-vars
  async getSignedUrl(_opts) {
    throw new Error('StorageProvider.getSignedUrl is not implemented');
  }

  // eslint-disable-next-line no-unused-vars
  async deleteDocument(_opts) {
    throw new Error('StorageProvider.deleteDocument is not implemented');
  }
}