import assert from 'node:assert/strict';
import test from 'node:test';
import { AtsService } from './ats.service.js';

test('ATS compatibility returns S grade for clean resumes', async () => {
  const service = new AtsService();
  const cleanResume = [
    'John Doe',
    'Email: john@example.com',
    'Summary: Experienced backend engineer with strong Node.js background.',
    'Work Experience:',
    '- Built scalable APIs and optimized performance metrics.',
  ].join('\n');

  const { atsCompatibility } = await service.apply(cleanResume, 'Backend engineer JD with clear requirements.');

  assert.equal(atsCompatibility.grade, 'S');
  assert.equal(atsCompatibility.score, 100);
  assert.match(atsCompatibility.advice, /符合 ATS 要求/);
});

test('ATS compatibility penalizes tables and executable markup heavily', async () => {
  const service = new AtsService();
  const riskyResume = '<table><tr><td>Education</td></tr></table><script>alert(1)</script>';

  const { atsCompatibility } = await service.apply(riskyResume, '<script>alert(1)</script>');

  assert.equal(atsCompatibility.grade, 'D');
  assert.ok(atsCompatibility.score <= 40);
  assert.match(atsCompatibility.advice, /表格/);
  assert.match(atsCompatibility.advice, /脚本|标签/);
});

test('ATS compatibility downgrades resumes with high non-ASCII ratio and spacing issues', async () => {
  const service = new AtsService();
  const heavyNonAscii = `${'经验'.repeat(60)}\tPython developer`;

  const { atsCompatibility } = await service.apply(heavyNonAscii, 'Python developer JD with clear text.');

  assert.equal(atsCompatibility.grade, 'C');
  assert.ok(atsCompatibility.score < 70);
  assert.match(atsCompatibility.advice, /ASCII/);
});

test('ATS compatibility accounts for noisy or unsafe job descriptions', async () => {
  const service = new AtsService();
  const resume = 'Product manager with experience leading cross-functional teams.';
  const noisyJd = '<style>div{}</style> $$$$ Very short JD';

  const { atsCompatibility } = await service.apply(resume, noisyJd);

  assert.equal(atsCompatibility.grade, 'B');
  assert.ok(atsCompatibility.score <= 80 && atsCompatibility.score >= 60);
  assert.match(atsCompatibility.advice, /岗位 JD/);
});
