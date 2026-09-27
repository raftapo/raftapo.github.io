/* No API keys, AI requests, analytics, or persistent note storage in this file. */
(() => {
  'use strict';
  const root = document.getElementById('math-ai');
  if (!root) return;
  const el = (id) => document.getElementById(`ma-${id}`);

  // Problems only: hidden worked solutions are deliberately not copied into prompts.
  const topics = {
    general: '',
    dot: 'Compute the dot product of x = (1, 2, 3) and w = (4, -1, 2).',
    gradient: 'For f(x,y) = x^2 + 3y^2, find the gradient at (1,2).',
    probability: 'A fair six-sided die is rolled. Given that its result is even, what is the probability that it is greater than 3?',
    update: 'For J(w) = (w - 3)^2, take one gradient-descent step starting at w = 0 with learning rate 0.1.',
    lab: 'A linear-regression model predicts y_hat = a*x + b. Explain how mean squared error, the partial derivatives with respect to a and b, and the learning rate are used in gradient descent.',
    regression: 'In the interactive regression lab, fit y_hat = a*x + b to the displayed data, then compare a manual fit with gradient descent. Explain the roles of slope a, intercept b, MSE, and the gradient.'
  };
  const modes = {
    hint: 'Give one useful hint and ask a guiding question. Do not reveal the final answer unless I ask for it later.',
    explain: 'Explain the underlying theory in accessible language, with a small example. Then ask a question that checks my understanding.',
    check: 'Check my attempted solution. Identify the first incorrect step, explain why, and let me try correcting it. If no attempt is included, ask me to provide one.',
    practice: 'Create one similar exercise at the same difficulty. Give the exercise first, without its answer, and wait for my attempt.',
    solution: 'Give a complete worked solution, justify each step, and verify the result.'
  };

  function invalidatePrompt() {
    el('prompt').value = '';
    el('copy').disabled = true;
    el('prompt-status').textContent = 'Create a new prompt after making changes. Nothing is sent automatically.';
  }
  ['topic', 'mode'].forEach((id) => el(id).addEventListener('change', invalidatePrompt));
  el('question').addEventListener('input', invalidatePrompt);
  el('build-prompt').disabled = false;

  el('build-prompt').addEventListener('click', () => {
  const question = el('question').value.trim().slice(0, 4000);
  const topic = topics[el('topic').value] || '';

  if (!question && !topic) {
    el('prompt-status').textContent =
      'Choose an exercise or write a question first.';
    el('question').focus();
    return;
  }

  const parts = [
    'Act as a careful mathematics and machine-learning tutor for a beginner undergraduate.',
    modes[el('mode').value] || modes.hint,
    'State assumptions, show useful mathematical steps, and acknowledge uncertainty. Use LaTeX for equations.'
  ];

  if (topic) parts.push(`EXERCISE OR TOPIC:\n${topic}`);
  if (question) parts.push(`MY QUESTION OR ATTEMPT:\n${question}`);

  el('prompt').value = parts.join('\n\n');
  el('copy').disabled = false;
  el('prompt-status').textContent =
    'Prompt ready. Review it before copying and pasting it into ChatGPT.';
});

  el('copy').addEventListener('click', async () => {
    const text = el('prompt').value;
    if (!text) return;
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(text);
      el('prompt-status').textContent = 'Copied. Open ChatGPT, paste the prompt, and send it there.';
    } catch (_) {
      el('prompt').focus();
      el('prompt').select();
      el('prompt-status').textContent = 'Automatic copying was blocked. The prompt is selected: use your device’s Copy command, then paste it in ChatGPT.';
    }
  });
  root.querySelectorAll('[data-tutor-exercise]').forEach((button) => {
    button.addEventListener('click', () => {
      el('topic').value = button.dataset.tutorExercise;
      invalidatePrompt();
      el('tutor').scrollIntoView({ block: 'start' });
      el('question').focus({ preventScroll: true });
    });
  });

  // Interactive two-parameter linear regression. Everything runs locally in the browser.
  const points = [
    { x: 0.00, y: 1.10 }, { x: 0.25, y: 2.10 }, { x: 0.50, y: 2.80 },
    { x: 0.75, y: 4.20 }, { x: 1.00, y: 5.10 }, { x: 1.25, y: 5.80 },
    { x: 1.50, y: 7.20 }, { x: 1.75, y: 7.90 }, { x: 2.00, y: 9.10 }
  ];
  let slope = 1;
  let intercept = 0;
  let step = 0;
  const format2 = (n) => Number.isFinite(n) ? n.toFixed(2) : '—';
  const format4 = (n) => Number.isFinite(n)
    ? (Math.abs(n) >= 1e6 ? n.toExponential(4) : n.toFixed(4))
    : '—';
  const mse = (a, b) => points.reduce((sum, p) => {
    const error = a * p.x + b - p.y;
    return sum + error * error;
  }, 0) / points.length;
  function gradients(a, b) {
    let da = 0;
    let db = 0;
    for (const p of points) {
      const error = a * p.x + b - p.y;
      da += p.x * error;
      db += error;
    }
    return { da: 2 * da / points.length, db: 2 * db / points.length };
  }
  function modelText(a, b) {
    return `ŷ = ${format2(a)}x ${b >= 0 ? '+' : '−'} ${format2(Math.abs(b))}`;
  }
  function drawRegressionPlot() {
    const svg = el('regression-plot');
    if (!svg) return;
    const W = 680, H = 430, L = 58, R = 22, T = 22, B = 50;
    const xMin = 0, xMax = 2.1, yMin = -2, yMax = 12;
    const sx = (x) => L + ((x - xMin) / (xMax - xMin)) * (W - L - R);
    const sy = (y) => H - B - ((y - yMin) / (yMax - yMin)) * (H - T - B);
    const ns = 'http://www.w3.org/2000/svg';
    const make = (name, attrs = {}, text = '') => {
      const node = document.createElementNS(ns, name);
      Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, String(value)));
      if (text) node.textContent = text;
      return node;
    };
    const frag = document.createDocumentFragment();
    const defs = make('defs');
    const clip = make('clipPath', { id: 'ma-regression-bounds' });
    clip.appendChild(make('rect', { x: L, y: T, width: W-L-R, height: H-T-B }));
    defs.appendChild(clip); frag.appendChild(defs);
    const grid = make('g', { class: 'ma-plot-grid' });
    for (let y = -2; y <= 12; y += 2) {
      grid.appendChild(make('line', { x1: L, y1: sy(y), x2: W - R, y2: sy(y) }));
      grid.appendChild(make('text', { x: L - 10, y: sy(y) + 4, 'text-anchor': 'end' }, String(y)));
    }
    for (let x = 0; x <= 2; x += 0.5) {
      grid.appendChild(make('line', { x1: sx(x), y1: T, x2: sx(x), y2: H - B }));
      grid.appendChild(make('text', { x: sx(x), y: H - B + 23, 'text-anchor': 'middle' }, x.toFixed(1)));
    }
    frag.appendChild(grid);
    frag.appendChild(make('line', { class: 'ma-axis', x1: L, y1: H - B, x2: W - R, y2: H - B }));
    frag.appendChild(make('line', { class: 'ma-axis', x1: L, y1: T, x2: L, y2: H - B }));
    const yAtLeft = slope * xMin + intercept;
    const yAtRight = slope * xMax + intercept;
    frag.appendChild(make('line', {
      class: 'ma-fit-line', 'clip-path': 'url(#ma-regression-bounds)', x1: sx(xMin), y1: sy(yAtLeft), x2: sx(xMax), y2: sy(yAtRight)
    }));
    const dots = make('g', { class: 'ma-data-points' });
    points.forEach((p) => dots.appendChild(make('circle', { cx: sx(p.x), cy: sy(p.y), r: 6 })));
    frag.appendChild(dots);
    frag.appendChild(make('text', { class: 'ma-axis-label', x: (L + W - R) / 2, y: H - 8, 'text-anchor': 'middle' }, 'x'));
    const yLabel = make('text', { class: 'ma-axis-label', x: 16, y: (T + H - B) / 2, 'text-anchor': 'middle', transform: `rotate(-90 16 ${(T + H - B) / 2})` }, 'y');
    frag.appendChild(yLabel);
    svg.replaceChildren(frag);
  }
  function renderLab(message) {
    el('a-value').textContent = format2(slope);
    el('b-value').textContent = format2(intercept);
    el('step-value').textContent = String(step);
    el('model-value').textContent = modelText(slope, intercept);
    el('loss-value').textContent = format4(mse(slope, intercept));
    if (message) {
      const outsideSliderRange = slope < -1 || slope > 7 || intercept < -2 || intercept > 4;
      el('lab-status').textContent = message + (outsideSliderRange
        ? ' The model is outside the manual slider range; read the numeric outputs. Reset to return to the initial values.' : '');
    }
    drawRegressionPlot();
  }
  function syncFromSliders() {
    slope = Number(el('a').value);
    intercept = Number(el('b').value);
    step = 0;
    renderLab('Manual mode: the line and MSE update immediately as you move the sliders.');
  }
  function train(count) {
    const rate = Number(el('rate').value);
    if (!Number.isFinite(rate) || rate <= 0 || rate > 0.5) return;
    const before = mse(slope, intercept);
    for (let i = 0; i < count; i += 1) {
      const { da, db } = gradients(slope, intercept);
      const nextA = slope - rate * da;
      const nextB = intercept - rate * db;
      if (!Number.isFinite(nextA) || !Number.isFinite(nextB) || Math.abs(nextA) > 1e6 || Math.abs(nextB) > 1e6 || step >= 2000) {
        el('a').value = String(Math.max(-1, Math.min(7, slope)));
        el('b').value = String(Math.max(-2, Math.min(4, intercept)));
        renderLab('Stopped at a safety limit. Reset and try a smaller learning rate.');
        return;
      }
      slope = nextA;
      intercept = nextB;
      step += 1;
    }
    el('a').value = String(Math.max(-1, Math.min(7, slope)));
    el('b').value = String(Math.max(-2, Math.min(4, intercept)));
    const after = mse(slope, intercept);
    const message = after < 0.05
      ? 'The fit is close to the least-squares minimum for these illustrative data.'
      : after > before * 1.001
        ? 'The loss increased. The selected learning rate is too aggressive from this position; reset or choose a smaller value.'
        : 'The loss decreased. Run more steps and watch both the line and the MSE.';
    renderLab(message);
  }
  ['a', 'b', 'rate', 'step', 'ten', 'reset'].forEach((id) => { if (el(id)) el(id).disabled = false; });
  el('a').addEventListener('input', syncFromSliders);
  el('b').addEventListener('input', syncFromSliders);
  el('step').addEventListener('click', () => train(1));
  el('ten').addEventListener('click', () => train(25));
  el('reset').addEventListener('click', () => {
    slope = 1;
    intercept = 0;
    step = 0;
    el('a').value = '1';
    el('b').value = '0';
    renderLab('Reset to a = 1 and b = 0. Try fitting the line manually or run gradient descent.');
  });
  el('rate').addEventListener('change', () => {
    el('lab-status').textContent = 'Learning rate changed. Reset if you want a fair comparison from the same starting parameters.';
  });
  renderLab('Move the sliders to fit the points manually, or let gradient descent update the parameters.');

})();
