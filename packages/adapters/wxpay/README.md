# WxPay adapter (fake placeholder)

This package offers a thin adapter layer for integrating WeChat Pay (JSAPI/Native).
It currently ships with a **fake** implementation so that upstream services can
exercise the payment flow without hitting the real gateway. Swap the internals
with the official SDK once credentials are ready.

## Exposed functions

| API | Description |
| --- | --- |
| `unifiedOrder(query)` | Creates a new payment order and returns a `SUCCESS` trade state immediately. The helper echoes common fields such as `out_trade_no`, `transaction_id`, `amount`, and `payer`. |
| `query(out_trade_no)` | Queries the trade status and always returns a successful, already-paid order for the provided `out_trade_no`. |
| `verifyCallback(headers, body)` | Validates the callback signature and surfaces the decrypted resource payload. The fake variant expects the header `Wechatpay-Signature: wxpay-fake-signature`. |

## Real integration checklist

When wiring the real gateway, replace the fake logic with a client built from
[wechatpay-axios-plugin](https://github.com/wechatpay-apiv3/wechatpay-axios-plugin)
or the official SDK. You will need the following parameters:

- `WXPAY_MCH_ID`: merchant ID
- `WXPAY_APP_ID`: Mini Program / Official Account app ID
- `WXPAY_SERIAL_NO`: platform certificate serial number
- `WXPAY_PRIVATE_KEY_PATH`: path to the merchant private key (PEM)
- `WXPAY_API_V3_KEY`: 32 byte API v3 key for decrypting callback payloads

Callbacks should forward the raw headers and body to `verifyCallback`. On
production, this method must:

1. Reconstruct the message signature with `timestamp`, `nonce`, and the raw body
   string.
2. Validate the signature against the platform certificate specified by the
   `Wechatpay-Serial` header.
3. Decrypt the `resource` field (AES-256-GCM) and return the clear-text data for
   business handling.

Until those steps are implemented, the fake signature guard prevents silent
misconfigurations during integration testing.
