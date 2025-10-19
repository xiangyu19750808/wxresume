export async function refund({ out_trade_no, amount }) {
  if (!out_trade_no || typeof amount !== "number") {
    throw new Error("bad params");
  }
  // 假退款：直接返回受理中
  return {
    refund_id: "fake_" + Date.now(),
    status: "processing",
    out_trade_no,
    amount
  };
}

export async function query(out_trade_no) {
  // 预留给对账：返回一个固定状态
  return { out_trade_no, trade_state: "SUCCESS" };
}
