import 'dotenv/config';
import { query as wxQuery } from '../packages/adapters/wxpay/index.js';

async function main() {
  const candidates = ['test-001', 'test-002']; // 占位：真实环境改为当天订单
  console.log('[reconcile] start');
  for (const id of candidates) {
    const wx = await wxQuery(id);          // 假数据：始终 SUCCESS
    const local = 'SUCCESS';               // 占位：本地订单状态
    const ok = wx.trade_state === local;
    console.log(` - ${id}: wx=${wx.trade_state} | local=${local} => ${ok ? 'OK' : 'MISMATCH'}`);
  }
  console.log('[reconcile] done');
}

main().catch(e => {
  console.error('[reconcile] error:', e);
  process.exit(1);
});
