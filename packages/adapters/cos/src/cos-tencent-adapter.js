import { StorageAdapter } from './storage-adapter.js';

export class CosTencentAdapter extends StorageAdapter {
  constructor({ secretId, secretKey, bucket, region } = {}) {
    super();
    this.secretId = secretId;
    this.secretKey = secretKey;
    this.bucket = bucket;
    this.region = region;
  }
}
