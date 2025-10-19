#!/usr/bin/env node

/**
 * Fake reconciliation job comparing local order snapshots with
 * mocked WeChat Pay responses. The goal is to highlight how the
 * daily process could surface mismatches before wiring to the
 * production gateway.
 */

const localOrders = [
  { out_trade_no: 'ORD0001', status: 'paid', amount: 1990 },
  { out_trade_no: 'ORD0002', status: 'paid', amount: 1990 },
  { out_trade_no: 'ORD0003', status: 'paid', amount: 2990 },
  { out_trade_no: 'ORD0004', status: 'refunding', amount: 1990 },
  { out_trade_no: 'ORD8888', status: 'paid', amount: 1990 },
];

const wxpaySnapshot = {
  ORD0001: { trade_state: 'SUCCESS', amount: { total: 1990, currency: 'CNY' } },
  ORD0002: {
    trade_state: 'NOTPAY',
    trade_state_desc: 'User has not paid yet.',
    amount: { total: 1990, currency: 'CNY' },
  },
  ORD0003: {
    trade_state: 'SUCCESS',
    amount: { total: 1990, currency: 'CNY' },
  },
  ORD0004: {
    trade_state: 'SUCCESS',
    trade_state_desc: 'Refund completed.',
    refund_status: 'SUCCESS',
    amount: { total: 1990, refund: 1990, currency: 'CNY' },
  },
  ORD9999: { trade_state: 'SUCCESS', amount: { total: 1990, currency: 'CNY' } },
};

const summary = {
  missingInWxpay: [],
  missingLocally: [],
  statusMismatch: [],
  amountMismatch: [],
  refundMismatch: [],
};

const normaliseAmount = (value) => {
  if (value == null) return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

(async () => {
  const { query } = await import('../packages/adapters/wxpay/src/index.js');

  const remoteKeys = new Set(Object.keys(wxpaySnapshot));

  for (const order of localOrders) {
    const expected = wxpaySnapshot[order.out_trade_no];
    if (!expected) {
      summary.missingInWxpay.push({
        out_trade_no: order.out_trade_no,
        local_status: order.status,
      });
      continue;
    }

    remoteKeys.delete(order.out_trade_no);

    const remote = await query({ out_trade_no: order.out_trade_no, ...expected });

    const remoteStatus = remote.trade_state;
    const localStatus = order.status;

    if (remoteStatus === 'SUCCESS' && localStatus !== 'paid') {
      summary.statusMismatch.push({
        out_trade_no: order.out_trade_no,
        local_status: localStatus,
        wxpay_status: remoteStatus,
        note: 'WXPay shows success but local order is not marked as paid.',
      });
    } else if (remoteStatus !== 'SUCCESS' && localStatus === 'paid') {
      summary.statusMismatch.push({
        out_trade_no: order.out_trade_no,
        local_status: localStatus,
        wxpay_status: remoteStatus,
        note: 'Local order is paid but WXPay snapshot is not success.',
      });
    }

    const localAmount = normaliseAmount(order.amount);
    const wxpayAmount = normaliseAmount(remote.amount?.total);
    if (localAmount != null && wxpayAmount != null && localAmount !== wxpayAmount) {
      summary.amountMismatch.push({
        out_trade_no: order.out_trade_no,
        local_amount: localAmount,
        wxpay_amount: wxpayAmount,
      });
    }

    if (localStatus === 'refunding') {
      const refundStatus = remote.raw?.refund_status || remote.trade_state;
      if (!refundStatus || refundStatus === 'SUCCESS') {
        summary.refundMismatch.push({
          out_trade_no: order.out_trade_no,
          local_status: localStatus,
          wxpay_status: refundStatus || remote.trade_state,
          note: 'Local refund requested but WXPay snapshot not in processing state.',
        });
      }
    }
  }

  for (const key of remoteKeys) {
    summary.missingLocally.push({ out_trade_no: key, wxpay_status: wxpaySnapshot[key].trade_state });
  }

  const hasDiffs = Object.values(summary).some((arr) => arr.length > 0);

  console.log('==============================');
  console.log(' WXPay Daily Reconciliation ');
  console.log('==============================');
  console.log(`Local orders inspected: ${localOrders.length}`);
  console.log(`WXPay snapshot records: ${Object.keys(wxpaySnapshot).length}`);
  console.log('');

  if (!hasDiffs) {
    console.log('No discrepancies detected.');
    return;
  }

  const emitSection = (title, records) => {
    if (!records.length) return;
    console.log(`- ${title} (${records.length})`);
    for (const item of records) {
      console.log(`  • ${JSON.stringify(item)}`);
    }
    console.log('');
  };

  emitSection('Missing in WXPay', summary.missingInWxpay);
  emitSection('Missing locally', summary.missingLocally);
  emitSection('Status mismatches', summary.statusMismatch);
  emitSection('Amount mismatches', summary.amountMismatch);
  emitSection('Refund state mismatches', summary.refundMismatch);
})();
