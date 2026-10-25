// Loads every test file, runs them and shows the result on the page.

import { run } from './harness.js';
import './engine.test.js';
import './scoring.test.js';
import './game.test.js';
import './stress.test.js';
import './share.test.js';
import './music.test.js';

const out = document.getElementById('out');
out.textContent = 'Running…';

const result = await run();
window.testResult = result; // read by automated checks

const lines = [`${result.passed} passed, ${result.failed} failed in ${result.ms} ms`];
for (const f of result.failures) lines.push(`✗ ${f.name}\n    ${f.message}`);
if (globalThis.botScores) lines.push(`\nBot scores (3 minutes): ${globalThis.botScores.join(', ')}`);
if (globalThis.linkSizes) lines.push(`Challenge links: ${globalThis.linkSizes.join(', ')}`);
out.textContent = lines.join('\n');
document.body.classList.add(result.failed ? 'fail' : 'pass');
