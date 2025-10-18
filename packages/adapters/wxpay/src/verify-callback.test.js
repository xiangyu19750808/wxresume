import assert from 'node:assert/strict';
import test from 'node:test';
import { verifyCallback } from './index.js';

const headersWith = (signature) => ({
  'Wechatpay-Signature': signature,
});

test('verifyCallback resolves when signature matches the fake expectation', async () => {
  const result = await verifyCallback(headersWith('wxpay-fake-signature'), {
    event_type: 'TRANSACTION.SUCCESS',
    resource: {
      out_trade_no: 'ORDER123',
      transaction_id: '420000000000',
      success_time: '2024-01-01T00:00:00+08:00',
    },
  });

  assert.equal(result.verified, true);
  assert.equal(result.out_trade_no, 'ORDER123');
  assert.equal(result.transaction_id, '420000000000');
  assert.equal(result.event_type, 'TRANSACTION.SUCCESS');
});

test('verifyCallback throws when signature mismatches', async () => {
  await assert.rejects(
    () =>
      verifyCallback(headersWith('tampered-signature'), {
        resource: { out_trade_no: 'ORDER123' },
      }),
    (error) => {
      assert.equal(error.code, 'ERR_WXPAY_INVALID_SIGNATURE');
      return true;
    }
  );
});
