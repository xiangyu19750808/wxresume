export class StorageAdapter {
  /**
   * @param {string} key
   * @param {unknown} body
   * @param {object} [options]
   * @returns {Promise<void>}
   */
  async putObject(key, body, options) {
    throw new Error('putObject() is not implemented');
  }

  /**
   * @param {string} key
   * @param {object} [options]
   * @returns {Promise<unknown>}
   */
  async getSignedUrl(key, options) {
    throw new Error('getSignedUrl() is not implemented');
  }

  /**
   * @param {string} key
   * @returns {Promise<unknown>}
   */
  async headObject(key) {
    throw new Error('headObject() is not implemented');
  }

  /**
   * @param {string} key
   * @returns {Promise<void>}
   */
  async deleteObject(key) {
    throw new Error('deleteObject() is not implemented');
  }
}
