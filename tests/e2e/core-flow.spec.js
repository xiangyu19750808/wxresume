import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const PORT = Number(process.env.E2E_PORT || 8080);
const BASE_URL = `http://127.0.0.1:${PORT}`;

let serverProcess;
const serverLogs = [];

async function waitForServerReady(proc, timeoutMs = 10_000) {
  let resolved = false;

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error(`Server did not start within ${timeoutMs}ms. Logs:\n${serverLogs.join('')}`));
    }, timeoutMs);

    const onData = (chunk) => {
      const text = chunk.toString();
      serverLogs.push(text);
      if (!resolved && text.includes('API listening on')) {
        resolved = true;
        cleanup();
        resolve();
      }
    };

    const onError = (chunk) => {
      serverLogs.push(chunk.toString());
    };

    const onExit = (code, signal) => {
      cleanup();
      const reason = signal ? `signal ${signal}` : `code ${code}`;
      reject(new Error(`Server exited before becoming ready (${reason}). Logs:\n${serverLogs.join('')}`));
    };

    function cleanup() {
      clearTimeout(timer);
      proc.stdout.off('data', onData);
      proc.stderr.off('data', onError);
      proc.off('exit', onExit);
    }

    proc.stdout.on('data', onData);
    proc.stderr.on('data', onError);
    proc.once('exit', onExit);
  });
}

before(async () => {
  serverProcess = spawn('node', ['src/server.js'], {
    env: {
      ...process.env,
      PORT: String(PORT),
      JWT_SECRET: process.env.JWT_SECRET || 'test-secret',
      NODE_ENV: 'test',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
    cwd: path.resolve('apps/api'),
  });

  serverProcess.stdout.setEncoding('utf8');
  serverProcess.stderr.setEncoding('utf8');

  await waitForServerReady(serverProcess);

  const capture = (chunk) => {
    serverLogs.push(chunk.toString());
  };

  serverProcess.stdout.on('data', capture);
  serverProcess.stderr.on('data', capture);

  // Give the server a brief moment to finish bootstrapping
  await delay(100);
});

after(async () => {
  if (!serverProcess) return;

  const exitPromise = new Promise((resolve) => {
    serverProcess.once('exit', () => resolve());
  });

  if (process.env.DEBUG_E2E_LOGS) {
    console.log(serverLogs.join(''));
  }

  serverProcess.kill('SIGTERM');
  await Promise.race([exitPromise, delay(500)]);
});

async function jsonFetch(url, init) {
  const res = await fetch(url, init);
  const body = await res.json();
  return { res, body };
}

async function pdfFetch(url, init) {
  const res = await fetch(url, init);
  const buffer = Buffer.from(await res.arrayBuffer());
  return { res, buffer };
}

test('end-to-end core user journey', async () => {
  // Health check should succeed with request ID
  const { res: healthRes, body: healthBody } = await jsonFetch(`${BASE_URL}/v1/health`);
  assert.equal(healthRes.status, 200);
  assert.equal(healthBody.code, 0);
  assert.equal(healthBody.msg, 'ok');
  assert.match(healthBody.requestId, /^[\w-]+$/);

  // Unauthenticated access should be blocked
  const { res: unauthRes, body: unauthBody } = await jsonFetch(`${BASE_URL}/v1/users/me`);
  assert.equal(unauthRes.status, 401);
  assert.equal(unauthBody.code, 401);
  assert.equal(unauthBody.msg, 'unauthorized');

  // Login via mock WX callback -> receive JWT token
  const { res: loginRes, body: loginBody } = await jsonFetch(`${BASE_URL}/v1/auth/wx/callback?code=e2e-seed`);
  assert.equal(loginRes.status, 200, `login http status unexpected: ${loginRes.status}`);
  assert.equal(loginBody.code, 0, `login failed: ${JSON.stringify(loginBody)}`);
  assert.ok(loginBody.data?.token);
  assert.ok(loginBody.data?.user?.id);
  const token = loginBody.data.token;

  // Authenticated profile fetch should succeed
  const { res: meRes, body: meBody } = await jsonFetch(`${BASE_URL}/v1/users/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.equal(meRes.status, 200);
  assert.equal(meBody.code, 0);
  assert.equal(meBody.data?.user?.id, loginBody.data.user.id);

  // Render resume PDF via templates -> expect binary payload and headers
  const minimalResume = {
    basics: {
      name: '测试用户',
      label: '全栈工程师',
      email: 'test@example.com'
    },
    skills: [
      { name: '后端', keywords: ['Node.js', '数据库'] },
      { name: '前端', keywords: ['React', 'TypeScript'] }
    ]
  };
  const { res: pdfRes, buffer: pdfBuffer } = await pdfFetch(
    `${BASE_URL}/v1/render/pdf?templateId=modern`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resume: minimalResume })
    }
  );
  assert.equal(pdfRes.status, 200);
  assert.equal(pdfRes.headers.get('content-type'), 'application/pdf');
  assert.equal(pdfRes.headers.get('x-template-id'), 'modern');
  assert.ok(pdfBuffer.byteLength > 0);

  // Request download signature and verify it serves bytes
  const fileId = 'resume-demo.pdf';
  const { body: downloadBody } = await jsonFetch(`${BASE_URL}/v1/file/download?file_id=${encodeURIComponent(fileId)}`);
  assert.equal(downloadBody.code, 0);
  assert.ok(downloadBody.data?.url);
  assert.ok(downloadBody.data?.expiresInSec > 0);

  const downloadRes = await fetch(downloadBody.data.url);
  assert.equal(downloadRes.status, 200);
  assert.equal(downloadRes.headers.get('content-type'), 'application/pdf');
  const pdfBytes = await downloadRes.arrayBuffer();
  assert.ok(pdfBytes.byteLength > 0);

  // Order creation, status polling, and payment callback should transition to paid
  const plan = 'pro';
  const amount = 9900;
  const { body: orderCreate } = await jsonFetch(`${BASE_URL}/v1/order/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ plan, amount }),
  });
  assert.equal(orderCreate.code, 0);
  assert.ok(orderCreate.data?.out_trade_no);
  assert.ok(orderCreate.data?.prepay_id);

  const outTradeNo = orderCreate.data.out_trade_no;

  const { body: orderStatusInitial } = await jsonFetch(`${BASE_URL}/v1/order/status?out_trade_no=${encodeURIComponent(outTradeNo)}`);
  assert.equal(orderStatusInitial.code, 0);
  assert.equal(orderStatusInitial.data?.status, 'created');
  assert.equal(orderStatusInitial.data?.plan, plan);
  assert.equal(orderStatusInitial.data?.amount, amount);

  const signatureHeader =
    process.env.WXPAY_FAKE_CALLBACK_SIGNATURE || 'wxpay-fake-signature';

  const { body: orderCallback } = await jsonFetch(`${BASE_URL}/v1/order/callback`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Wechatpay-Signature': signatureHeader,
    },
    body: JSON.stringify({ out_trade_no: outTradeNo, result: 'SUCCESS', amount }),
  });
  assert.equal(orderCallback.code, 0);
  assert.equal(orderCallback.data?.status, 'paid');
  assert.equal(orderCallback.data?.status_changed, true);

  const { body: orderCallbackReplay } = await jsonFetch(`${BASE_URL}/v1/order/callback`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Wechatpay-Signature': signatureHeader,
    },
    body: JSON.stringify({ out_trade_no: outTradeNo, result: 'SUCCESS', amount }),
  });
  assert.equal(orderCallbackReplay.code, 0);
  assert.equal(orderCallbackReplay.data?.status, 'paid');
  assert.equal(orderCallbackReplay.data?.status_changed, false);
  assert.equal(
    orderCallbackReplay.data?.callbacks?.statuses?.SUCCESS?.count,
    2
  );

  const { body: orderStatusFinal } = await jsonFetch(`${BASE_URL}/v1/order/status?out_trade_no=${encodeURIComponent(outTradeNo)}`);
  assert.equal(orderStatusFinal.code, 0);
  assert.equal(orderStatusFinal.data?.status, 'paid');
  assert.equal(orderStatusFinal.data?.callbacks?.statuses?.SUCCESS?.count, 2);
});

test('advanced matching endpoints provide scores and suggestions', async () => {
  const resumeProfile = {
    basics: { name: '测试候选人' },
    summary: 'Data scientist with fintech background using Python and NLP.',
    education: [
      {
        institution: 'Tsinghua University',
        studyType: 'Master',
        area: 'Computer Science',
        startDate: '2016-09-01',
        endDate: '2018-07-01',
      },
      {
        institution: 'Peking University',
        studyType: 'Bachelor',
        area: 'Software Engineering',
        startDate: '2012-09-01',
        endDate: '2016-07-01',
      },
    ],
    languages: [
      { name: 'English', level: 'C1', score: 105 },
      { name: 'Mandarin', level: 'Native' },
    ],
    work: [
      {
        company: 'FinTech Co',
        position: 'Data Scientist',
        startDate: '2018-08-01',
        endDate: '2022-12-31',
        highlights: [
          'Built NLP pipeline for risk control',
          'Communicated findings to stakeholders',
        ],
        industries: ['FinTech', 'AI'],
      },
      {
        company: 'AI Labs',
        position: 'Machine Learning Engineer',
        startDate: '2023-01-01',
        endDate: '2024-01-01',
        highlights: ['Developed recommendation engine in Python'],
        industries: ['AI', 'E-commerce'],
      },
    ],
    salaryExpectation: { amountAnnual: 350000, currency: 'CNY' },
  };

  const headers = { 'Content-Type': 'application/json' };

  const { body: educationMatch } = await jsonFetch(`${BASE_URL}/v1/education/match`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      resume: resumeProfile,
      job: { requiredDegree: 'Bachelor', preferredMajors: ['Computer Science', 'Software Engineering'] },
    }),
  });
  assert.equal(educationMatch.code, 0);
  assert.ok(educationMatch.data?.score >= 90, `education score ${educationMatch.data?.score}`);
  assert.ok(Array.isArray(educationMatch.data?.matchedMajors));
  assert.ok(educationMatch.data?.matchedMajors.length >= 2);

  const { body: educationEdge } = await jsonFetch(`${BASE_URL}/v1/education/match`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ job: { requiredDegree: 'Master' } }),
  });
  assert.equal(educationEdge.code, 0);
  assert.ok(educationEdge.data?.score <= 60);
  console.log('✓ 教育背景匹配功能测试通过');

  const { body: languageAbility } = await jsonFetch(`${BASE_URL}/v1/language/ability`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      resume: resumeProfile,
      job: {
        requirements: [
          { language: 'English', level: 'C1', minScore: 100 },
          { language: 'Mandarin', level: 'Native' },
        ],
      },
    }),
  });
  assert.equal(languageAbility.code, 0);
  assert.ok(languageAbility.data?.score >= 90, `language score ${languageAbility.data?.score}`);
  assert.equal(languageAbility.data?.evaluations?.length, 2);

  const { body: languageEdge } = await jsonFetch(`${BASE_URL}/v1/language/ability`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ job: { requirements: [{ language: 'Japanese', level: 'N2' }] } }),
  });
  assert.equal(languageEdge.code, 0);
  assert.ok(languageEdge.data?.score < languageAbility.data?.score);
  console.log('✓ 语言能力评估功能测试通过');

  const { body: experienceMatch } = await jsonFetch(`${BASE_URL}/v1/experience/match`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      resume: resumeProfile,
      job: { requiredYears: 4, fields: ['fintech', 'machine learning'] },
    }),
  });
  assert.equal(experienceMatch.code, 0);
  assert.ok(experienceMatch.data?.score >= 90);
  assert.ok(experienceMatch.data?.relevantYears >= 4);

  const { body: experienceEdge } = await jsonFetch(`${BASE_URL}/v1/experience/match`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ resume: { work: [] }, job: { requiredYears: 2 } }),
  });
  assert.equal(experienceEdge.code, 0);
  assert.ok(experienceEdge.data?.score <= 10);
  console.log('✓ 详细经历对齐功能测试通过');

  const resumeText =
    'Data scientist with fintech experience building NLP pipeline using Python and machine learning.';
  const jdText =
    'The role requires data scientists to design machine learning systems for fintech clients using Python.';
  const keywords = ['data', 'fintech', 'python', 'golang'];

  const { body: keywordFrequency } = await jsonFetch(`${BASE_URL}/v1/keywords/frequency_analysis`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ resume_text: resumeText, jd_text: jdText, jd_keywords: keywords }),
  });
  assert.equal(keywordFrequency.code, 0);
  assert.equal(keywordFrequency.data?.frequencies?.length, keywords.length);
  assert.ok(keywordFrequency.data?.score >= 50);

  const { body: keywordEdge } = await jsonFetch(`${BASE_URL}/v1/keywords/frequency_analysis`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ resume_text: '', jd_keywords: ['cloud'] }),
  });
  assert.equal(keywordEdge.code, 0);
  assert.equal(keywordEdge.data?.frequencies?.[0]?.resumeCount, 0);
  console.log('✓ 关键词频次分析功能测试通过');

  const { body: contextualAnalysis } = await jsonFetch(`${BASE_URL}/v1/keywords/contextual_analysis`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ resume_text: resumeText, jd_text: jdText }),
  });
  assert.equal(contextualAnalysis.code, 0);
  assert.ok(contextualAnalysis.data?.score >= 60);
  assert.ok(Array.isArray(contextualAnalysis.data?.overlapTokens));

  const { body: contextualEdge } = await jsonFetch(`${BASE_URL}/v1/keywords/contextual_analysis`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ resume_text: '', jd_text: '' }),
  });
  assert.equal(contextualEdge.code, 0);
  assert.equal(contextualEdge.data?.score, 0);
  console.log('✓ 上下文语义分析功能测试通过');

  const { body: responsibilitiesMatch } = await jsonFetch(`${BASE_URL}/v1/job/responsibilities_match`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      resume: resumeProfile,
      job: {
        responsibilities: [
          'Build NLP pipelines for risk control',
          'Communicate findings to stakeholders',
        ],
      },
    }),
  });
  assert.equal(responsibilitiesMatch.code, 0);
  assert.equal(responsibilitiesMatch.data?.evaluation?.length, 2);
  assert.ok(responsibilitiesMatch.data?.score >= 90);

  const { body: responsibilitiesEdge } = await jsonFetch(`${BASE_URL}/v1/job/responsibilities_match`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ job: { responsibilities: ['Design microservices'] } }),
  });
  assert.equal(responsibilitiesEdge.code, 0);
  assert.ok(responsibilitiesEdge.data?.score <= 50);
  console.log('✓ 职位职责匹配功能测试通过');

  const { body: industryFit } = await jsonFetch(`${BASE_URL}/v1/industry/fit`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      resume: resumeProfile,
      job: { industry: 'FinTech', similarIndustries: ['Financial Services'] },
    }),
  });
  assert.equal(industryFit.code, 0);
  assert.equal(industryFit.data?.score, 100);
  assert.ok(industryFit.data?.resumeIndustries?.includes('FinTech'));

  const { body: industryEdge } = await jsonFetch(`${BASE_URL}/v1/industry/fit`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ job: { industry: 'Healthcare' } }),
  });
  assert.equal(industryEdge.code, 0);
  assert.ok(industryEdge.data?.score <= 55);
  console.log('✓ 行业适配度分析功能测试通过');

  const { body: salaryFit } = await jsonFetch(`${BASE_URL}/v1/salary/fit`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      resume: resumeProfile,
      job: { salaryRange: { min: 320000, max: 360000, currency: 'CNY' } },
    }),
  });
  assert.equal(salaryFit.code, 0);
  assert.equal(salaryFit.data?.score, 100);

  const { body: salaryEdge } = await jsonFetch(`${BASE_URL}/v1/salary/fit`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      resume: { salaryExpectation: { amountAnnual: 500000, currency: 'CNY' } },
      job: { salaryRange: { min: 200000, max: 300000, currency: 'CNY' } },
    }),
  });
  assert.equal(salaryEdge.code, 0);
  assert.ok(salaryEdge.data?.score < 80);
  console.log('✓ 薪资价值匹配功能测试通过');
});
