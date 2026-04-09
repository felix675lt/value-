const https = require('https');

/**
 * 토스페이먼츠 결제 승인 API 호출
 * [CRITICAL] 에스크로 입금 시 반드시 서버사이드 결제 검증
 *
 * @param {string} paymentKey - 토스페이먼츠 paymentKey
 * @param {string} orderId - 주문 ID
 * @param {number} amount - 결제 금액 (원)
 * @returns {Promise<object>} 토스페이먼츠 응답
 */
async function confirmPayment(paymentKey, orderId, amount) {
  const secretKey = process.env.TOSS_SECRET_KEY;
  if (!secretKey) {
    throw Object.assign(new Error('결제 서비스 설정 오류'), { status: 500 });
  }

  // 테스트 환경에서는 mock 처리 (test_ prefix)
  if (secretKey.startsWith('test_')) {
    console.log('[PaymentService] Test mode — skipping real API call');
    return {
      paymentKey,
      orderId,
      totalAmount: amount,
      status: 'DONE',
      method: 'TEST',
    };
  }

  const auth = Buffer.from(secretKey + ':').toString('base64');

  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ paymentKey, orderId, amount });

    const req = https.request({
      hostname: 'api.tosspayments.com',
      path: `/v1/payments/confirm`,
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
      },
    }, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        const parsed = JSON.parse(body);
        if (res.statusCode === 200) {
          resolve(parsed);
        } else {
          const err = new Error(parsed.message || '결제 승인 실패');
          err.status = 400;
          err.tossError = parsed;
          reject(err);
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

module.exports = { confirmPayment };
