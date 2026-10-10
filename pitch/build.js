// Builds BADGE_AgntID_Pitch.pptx in the razak.dev "field notes" style (helpers from the Lyzr deck).  Run: node build.js
// Fonts (install before presenting): Caveat, Manrope, DM Mono (Google Fonts).
const pptxgen = require('C:/Users/moham/Projects/lyzr-fde-bounty-challenge/pitch/node_modules/pptxgenjs');

const pptx = new pptxgen();
pptx.layout = 'LAYOUT_WIDE'; // 13.333 x 7.5 in
pptx.title = 'BADGE - every AI employee gets a badge';

// razak.dev palette (ascii.css :root + notebook)
const C = {
  paper: 'F7F8F3', ink: '162122', quiet: '85918E', line: 'DFE4DC', signal: '2F77D1', hot: 'D96D3C',
  note: 'F3CF60', noteEdge: 'BDA34F', noteInk: '504924', noteRule: 'E2BE55', caption: 'F7DFA0', captionInk: '5D4B15',
  purple: '7750CE', green: '469274',
};
const HAND = 'Caveat', BODY = 'Manrope', MONO = 'DM Mono';
const W = 13.333, H = 7.5;
const SECTIONS = ['the breach', 'why', 'badge', 'demo', 'next'];

// ---------- helpers ----------

// Faint ASCII field behind everything, like the site background.
const FIELD = (() => {
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const rows = [];
  for (let r = 0; r < 34; r++) {
    let row = '';
    for (let c = 0; c < 57; c++) {
      const v = rnd();
      row += (v < 0.55 ? '.' : v < 0.8 ? '·' : v < 0.93 ? ':' : '+') + '   ';
    }
    rows.push(row);
  }
  return rows.join('\n');
})();

function base(n) {
  const s = pptx.addSlide();
  s.background = { color: C.paper };
  s.addText(FIELD, { x: 0, y: 0, w: W, h: H, fontFace: MONO, fontSize: 7, color: 'E7EBE4', lineSpacing: 15.8, margin: 0, valign: 'top' });

  // nav bar, like the site header
  s.addText('Mohammed Razak', { x: 0.55, y: 0.18, w: 3, h: 0.45, fontFace: HAND, fontSize: 22, bold: true, color: '31413D', margin: 0, valign: 'middle' });
  s.addText(SECTIONS.map((t, i) => ({
    text: `${String(i + 1).padStart(2, '0')} ${t}${i < SECTIONS.length - 1 ? '     ' : ''}`,
    options: { color: i + 1 === n ? C.signal : '6F7B78', bold: i + 1 === n },
  })), { x: 5.2, y: 0.18, w: W - 5.75, h: 0.45, fontFace: MONO, fontSize: 9, align: 'right', valign: 'middle', margin: 0 });
  s.addShape(pptx.ShapeType.line, { x: 0.55, y: 0.68, w: W - 1.1, h: 0, line: { color: C.line, width: 1 } });
  return s;
}

// "▪ label" eyeline with the blue square
function eyeline(s, x, y, text, w = 5) {
  s.addShape(pptx.ShapeType.rect, { x, y: y + 0.075, w: 0.09, h: 0.09, fill: { color: C.signal }, line: { color: C.signal, width: 0 } });
  s.addText(text.toUpperCase(), { x: x + 0.2, y, w, h: 0.24, fontFace: MONO, fontSize: 10, color: '71817D', margin: 0, valign: 'middle', charSpacing: 1 });
}

// Place a child box so it rotates with a parent group around (cx, cy).
function rotated(cx, cy, rot, bx, by, bw, bh) {
  const t = (rot * Math.PI) / 180;
  const dx = bx + bw / 2 - cx, dy = by + bh / 2 - cy;
  const nx = dx * Math.cos(t) - dy * Math.sin(t), ny = dx * Math.sin(t) + dy * Math.cos(t);
  return { x: cx + nx - bw / 2, y: cy + ny - bh / 2, w: bw, h: bh, rotate: rot };
}

// Photo print with caption strip + hard offset shadow (site's .landing-photo).
// img: path, or null for a placeholder with `hint`.
// video: mp4 path (img is then its poster frame); autoplay/loop is set afterwards by autoplay.ps1.
function photo(s, { x, y, w, h, rot = 0, img, video, caption, hint }) {
  const capH = 0.36, total = h + capH, cx = x + w / 2, cy = y + total / 2;
  const R = (bx, by, bw, bh) => rotated(cx, cy, rot, bx, by, bw, bh);
  s.addShape(pptx.ShapeType.rect, { ...R(x + 0.1, y + 0.11, w, total), fill: { color: '7C5F16', transparency: 86 }, line: { color: C.paper, width: 0, transparency: 100 } });
  if (video) {
    s.addMedia({ type: 'video', path: video, cover: 'data:image/jpeg;base64,' + require('fs').readFileSync(img).toString('base64'), ...R(x, y, w, h) });
  } else if (img) {
    s.addImage({ path: img, ...R(x, y, w, h), sizing: { type: 'cover', w, h } });
  } else {
    s.addText([
      { text: 'PASTE HERE', options: { fontFace: MONO, fontSize: 11, bold: true, color: C.hot, breakLine: true } },
      { text: hint, options: { fontFace: BODY, fontSize: 12, color: C.quiet } },
    ], { ...R(x, y, w, h), align: 'center', valign: 'middle', shape: pptx.ShapeType.rect, fill: { color: 'FBFBF7' }, line: { color: C.hot, width: 1.25, dashType: 'dash' } });
  }
  s.addText(caption.toUpperCase(), {
    ...R(x, y + h, w, capH), fontFace: MONO, fontSize: 9, color: C.captionInk, fill: { color: C.caption }, margin: [10, 2, 10, 2], valign: 'middle',
    line: { color: '342A0C', width: 0.75, transparency: 60 },
  });
}

// Yellow ruled notebook card (site's .about-notebook). Not rotated so the rules stay straight.
function notebook(s, x, y, w, h, tab) {
  s.addShape(pptx.ShapeType.rect, { x: x + 0.14, y: y + 0.15, w, h, fill: { color: '7C5F16', transparency: 86 }, line: { color: C.paper, width: 0, transparency: 100 } });
  s.addShape(pptx.ShapeType.rect, { x, y, w, h, fill: { color: C.note }, line: { color: C.noteEdge, width: 1 } });
  for (let ly = y + 0.39; ly < y + h - 0.05; ly += 0.39) {
    s.addShape(pptx.ShapeType.line, { x, y: ly, w, h: 0, line: { color: C.noteRule, width: 0.75 } });
  }
  // tape
  s.addShape(pptx.ShapeType.rect, { x: x + w - 0.85, y: y - 0.1, w: 0.62, h: 0.2, rotate: 4, fill: { color: 'FFFFFF', transparency: 55 }, line: { color: '3A2E0A', width: 0.5, transparency: 70 } });
  if (tab) {
    s.addText(tab.toUpperCase(), { x: x + w - 2.75, y, w: 1.65, h: 0.26, fontFace: MONO, fontSize: 7.5, color: '4D4218', align: 'center', valign: 'middle', fill: { color: 'E7B947' }, line: { color: C.noteEdge, width: 0.75 }, margin: 0 });
  }
}

// Mono label + one short line.
function labelled(s, x, y, w, label, text, color = C.ink, size = 17, h = 0.5) {
  s.addText(label.toUpperCase(), { x, y, w, h: 0.26, fontFace: MONO, fontSize: 9.5, color: C.quiet, margin: 0, charSpacing: 1 });
  s.addText(inline(text, color), { x, y: y + 0.27, w, h, fontFace: BODY, fontSize: size, margin: 0, valign: 'top' });
}

// '[...]' spans render in the site's orange so fill-ins are easy to spot.
function inline(str, color) {
  return str.split(/(\[[^\]]*\])/).filter(Boolean).map((t) => ({ text: t, options: { color: t.startsWith('[') ? C.hot : color } }));
}

// ---------------- 1. the breach ----------------
{
  const s = base(1);
  photo(s, { x: 0.6, y: 1.05, w: 5.9, h: 4.55, rot: -1.5, img: 'img/instinct.png', caption: 'techcrunch · aug 24, 2026' });
  photo(s, { x: 4.6, y: 3.35, w: 2.4, h: 3.3, rot: 3, img: 'img/tweet_3.png', caption: '"36 gmail records are still there"' });

  const nx = 7.75, nw = 5.05;
  notebook(s, nx, 1.05, nw, 5.85, 'field notes / oct 10');
  eyeline(s, nx + 0.35, 1.45, 'personal ai agents, 2026');
  s.addText('Your agent has the keys to everything.', { x: nx + 0.35, y: 1.8, w: nw - 0.6, h: 1.6, fontFace: HAND, fontSize: 40, bold: true, color: '21221C', margin: 0, valign: 'top', lineSpacingMultiple: 0.8 });
  s.addText('Nobody checks what it does with them.', { x: nx + 0.35, y: 3.4, w: nw - 0.6, h: 0.9, fontFace: HAND, fontSize: 28, bold: true, color: C.hot, margin: 0, valign: 'top', lineSpacingMultiple: 0.85 });
  [
    [C.hot, 'Always on: screen, email, messages'],
    [C.purple, 'Passwords & payments to act for you'],
    [C.signal, 'Perpetual, irrevocable license'],
    [C.green, 'Asked to delete: "I can’t"'],
  ].forEach(([c, t], i) => {
    const y = 4.45 + i * 0.55;
    s.addShape(pptx.ShapeType.rect, { x: nx + 0.38, y: y + 0.13, w: 0.07, h: 0.07, fill: { color: c }, line: { color: c, width: 0 } });
    s.addText(t, { x: nx + 0.58, y, w: nw - 0.9, h: 0.34, fontFace: BODY, fontSize: 15, bold: true, color: C.noteInk, margin: 0, valign: 'middle' });
  });
  s.addNotes(`[~0:45]
Six weeks ago, Instinct launched. A personal AI assistant. VCs and founders hyped it all week.

Then people read the fine print. [point at the photo] TechCrunch: "Instinct's powerful AI assistant is raising privacy and security concerns."

The assistant is always on. It sees your screen, your emails, your messages. You hand it passwords and payment details so it can act for you. The terms give them a perpetual, irrevocable license to all of it.

And my favourite: Peter Yang asked it to delete his Gmail data. The agent said, honestly: "The wipe I can't do. Those 36 Gmail records are still there."

The agent wasn't evil. It just had the keys to everything, and nobody was checking what it did with them.`);
}

// ---------------- 2. why ----------------
{
  const s = base(2);
  photo(s, { x: 0.6, y: 1.05, w: 2.75, h: 4.9, rot: -2, img: 'img/tweet_2.png', caption: '"always on · any interaction"' });
  photo(s, { x: 3.55, y: 1.25, w: 2.95, h: 3.7, rot: 2, img: 'img/tweet_1.png', caption: '"perpetual & irrevocable"' });

  const rx = 7.0, rw = 5.8;
  eyeline(s, rx, 1.05, 'why this keeps happening');
  s.addText('One agent. One session. Every key.', { x: rx, y: 1.35, w: rw + 0.3, h: 0.9, fontFace: HAND, fontSize: 30, bold: true, color: '21221C', margin: 0, valign: 'top' });
  const rows = [
    ['over-access', 'Agents get your whole account, not the task.'],
    ['no boundary', 'The CMO bot can read payroll. Nothing stops it.'],
    ['injection', 'One poisoned page and it exfiltrates.'],
    ['oversharing', 'Every agent hears every meeting, every secret.'],
  ];
  rows.forEach(([k, v], i) => {
    const y = 2.55 + i * 0.75;
    s.addText(String(i + 1).padStart(2, '0'), { x: rx, y, w: 0.45, h: 0.45, fontFace: MONO, fontSize: 10, color: C.quiet, margin: 0, valign: 'middle' });
    s.addText(k, { x: rx + 0.5, y: y - 0.06, w: 1.9, h: 0.55, fontFace: HAND, fontSize: 26, bold: true, color: C.hot, margin: 0, valign: 'middle' });
    s.addText(v, { x: rx + 2.45, y, w: rw - 2.45, h: 0.45, fontFace: BODY, fontSize: 14, color: C.ink, margin: 0, valign: 'middle' });
    s.addShape(pptx.ShapeType.line, { x: rx, y: y + 0.6, w: rw, h: 0, line: { color: C.line, width: 0.75 } });
  });
  s.addText('IAM checks the person. Nobody checks the agent.', { x: rx, y: 5.75, w: rw, h: 0.8, fontFace: HAND, fontSize: 30, bold: true, color: C.signal, margin: 0 });
  s.addNotes(`[~0:40]
Why does this keep happening? Because today an agent gets one session with every key you own.

One: over-access. It gets your whole account, not just what the task needs.
Two: no boundaries between agents. Your marketing bot can read payroll, and nothing stops it.
Three: prompt injection. One poisoned web page or doc, and it ships your data out.
Four: oversharing. Every agent hears every meeting, including the parts nobody should hear.

Our identity systems check the person. Nobody checks the agent, at the moment it acts.`);
}

// ---------------- 3. badge ----------------
{
  const s = base(3);
  eyeline(s, 0.6, 1.0, 'what we built today');
  s.addText([
    { text: 'BADGE: ', options: { color: '21221C' } },
    { text: 'every AI employee gets a badge.', options: { color: C.signal } },
  ], { x: 0.6, y: 1.3, w: 12.1, h: 0.85, fontFace: HAND, fontSize: 42, bold: true, margin: 0, valign: 'top' });
  s.addText('AgntID checks every tool call against it, at runtime.', { x: 0.6, y: 2.1, w: 12.1, h: 0.45, fontFace: BODY, fontSize: 18, color: C.ink, margin: 0 });

  const box = (x, w, title, lines, color) => {
    s.addShape(pptx.ShapeType.rect, { x: x + 0.08, y: 2.98, w, h: 2.6, fill: { color: '7C5F16', transparency: 88 }, line: { color: C.paper, width: 0, transparency: 100 } });
    s.addShape(pptx.ShapeType.rect, { x, y: 2.9, w, h: 2.6, fill: { color: 'FFFFFF' }, line: { color, width: 1.5 } });
    s.addText(title, { x: x + 0.2, y: 3.0, w: w - 0.4, h: 0.55, fontFace: HAND, fontSize: 26, bold: true, color, margin: 0 });
    s.addText(lines.map((t) => ({ text: t, options: { breakLine: true } })), { x: x + 0.2, y: 3.6, w: w - 0.4, h: 1.8, fontFace: BODY, fontSize: 13, color: C.ink, margin: 0, valign: 'top', paraSpaceAfter: 4 });
  };
  box(0.6, 2.6, 'you', ['Chat with the firm', 'or just talk: live', 'meeting via Deepgram'], C.quiet);
  box(3.6, 2.9, 'AI employees', ['Mira · CMO', 'Arun · Analyst', 'Jules · CTO', 'each with its own badge'], C.purple);
  box(6.9, 3.2, 'AgntID runtime', ['guard → intent → policy', '→ creds → execute', 'badge = delegation allowlist', 'every decision audited'], C.signal);
  box(10.5, 2.25, 'tools', ['Supabase', 'Notion', 'Meeting MCP'], C.green);
  [3.25, 6.55, 10.15].forEach((x) => s.addText('→', { x, y: 3.85, w: 0.4, h: 0.6, fontFace: BODY, fontSize: 28, bold: true, color: C.hot, align: 'center', margin: 0 }));

  s.addText('No code change to the agent. Just policy.', { x: 0.6, y: 5.95, w: 12.1, h: 0.7, fontFace: HAND, fontSize: 32, bold: true, color: C.hot, margin: 0 });
  s.addNotes(`[~0:35]
So here's what I built today: BADGE. An AI company where every AI employee gets a badge.

[left to right] You chat with the firm, or just talk, live. The employees are Mira the CMO, Arun the analyst, and Jules the CTO, and each one has its own badge.

Every single tool call goes through the AgntID runtime: guardrails, intent, policy, credentials, then execution. The badge is an AgntID delegation allowlist, so AgntID, not my code, decides. Every decision lands in AgntID's audit log.

The tools are real: Supabase, Notion, and a meeting server I wrote.

No code change to the agent. Just policy. Let me show you.

[SWITCH TO THE DEMO]`);
}

// ---------------- 4. demo ----------------
{
  const s = base(4);
  photo(s, { x: 0.6, y: 1.05, w: 6.2, h: 3.5, rot: -1, img: 'img/firm.png', caption: 'mira blocked · arun allowed · real supabase' });
  photo(s, { x: 6.55, y: 1.25, w: 6.2, h: 3.5, rot: 1.2, img: 'img/meeting.png', caption: 'live meeting · each agent hears its part' });
  const steps = [
    ['01', 'Mira asks the DB', 'BLOCKED: not on her badge'],
    ['02', 'Hands off to Arun', 'ALLOWED: real numbers'],
    ['03', 'Publishes to Notion', 'ALLOWED: open the page'],
    ['04', 'Say it in a meeting', 'only the right agent hears'],
    ['05', 'Flip to bypass', 'the CMO roams your DB'],
  ];
  steps.forEach(([n, a, b], i) => {
    const x = 0.6 + i * 2.48;
    s.addText(n, { x, y: 5.35, w: 2.3, h: 0.3, fontFace: MONO, fontSize: 10, color: C.quiet, margin: 0 });
    s.addText(a, { x, y: 5.62, w: 2.35, h: 0.5, fontFace: HAND, fontSize: 22, bold: true, color: '21221C', margin: 0, valign: 'top' });
    s.addText(b, { x, y: 6.12, w: 2.35, h: 0.5, fontFace: BODY, fontSize: 12, color: i === 0 || i === 4 ? C.hot : C.green, bold: true, margin: 0, valign: 'top' });
  });
  s.addNotes(`[DEMO ~2:30]  (this slide is the backup if the live demo breaks)

1. [Firm, Enforce ON] Type: "@mira Draft the Q3 launch post with September revenue by channel and publish it to the Launch Desk in Notion."
   - "Mira is the CMO. She tries the payments database. Red: BLOCKED. AgntID says the database isn't on her badge."
   - "So she does what a real employee does: asks the analyst. That handoff is an AgntID delegation."
   - "Arun is cleared. Green: real numbers from Supabase. Five checkpoints: guard, intent, policy, creds, execute."
   - "Mira publishes it to Notion." [click Published to Notion, show the page, come back]

2. [Live meeting widget, press mic] Say:
   - "September closed at 70 lakh and runway is 14 months." -> only Arun ticks green.
   - "Launch is locked for October 20th." -> only Mira.
   - "We're letting a contractor go next week." -> nobody. All red.
   - "Every agent only hears the part of the meeting its badge allows, decided by AgntID, live. And they file it into their own Notion pages." [open Arun's notes page]

3. [Flip toggle to BYPASS, rerun step 1's prompt]
   - "This is everyone else's agent today. No badge. The CMO goes straight into your production database."
   [flip back to ENFORCE]`);
}

// ---------------- 5. next ----------------
{
  const s = base(5);
  const nx = 0.6, nw = 6.3;
  notebook(s, nx, 1.05, nw, 5.85, 'what agntid gave us');
  eyeline(s, nx + 0.35, 1.45, 'real, not mocked');
  s.addText('Every block you saw was AgntID.', { x: nx + 0.35, y: 1.8, w: nw - 0.6, h: 1.0, fontFace: HAND, fontSize: 34, bold: true, color: '21221C', margin: 0, valign: 'top' });
  [
    [C.signal, 'Badges = delegation tool allowlists'],
    [C.purple, 'Handoffs = AgntID delegations (no escalation)'],
    [C.hot, 'Meeting routing = one AgntID check per agent'],
    [C.green, 'Every decision in the AgntID audit log'],
  ].forEach(([c, t], i) => {
    const y = 3.05 + i * 0.6;
    s.addShape(pptx.ShapeType.rect, { x: nx + 0.38, y: y + 0.13, w: 0.07, h: 0.07, fill: { color: c }, line: { color: c, width: 0 } });
    s.addText(t, { x: nx + 0.58, y, w: nw - 0.9, h: 0.34, fontFace: BODY, fontSize: 15, bold: true, color: C.noteInk, margin: 0, valign: 'middle' });
  });

  const rx = 7.4, rw = 5.4;
  eyeline(s, rx, 1.05, 'next');
  [
    ['computer use', 'Each agent gets its own browser. AgntID decides which sites.'],
    ['parameter rules', 'sum(amount) yes. email, card_last4 no.'],
    ['right to forget', 'Delete means delete, enforced at the tool.'],
  ].forEach(([k, v], i) => {
    const y = 1.45 + i * 1.05;
    s.addText(k, { x: rx, y, w: rw, h: 0.5, fontFace: HAND, fontSize: 28, bold: true, color: C.signal, margin: 0 });
    s.addText(v, { x: rx, y: y + 0.48, w: rw, h: 0.4, fontFace: BODY, fontSize: 14, color: C.ink, margin: 0 });
  });
  s.addText('Give agents badges, not keys.', { x: rx, y: 5.4, w: rw, h: 1.0, fontFace: HAND, fontSize: 40, bold: true, color: C.hot, margin: 0, valign: 'top' });
  s.addNotes(`[~0:30]
Everything you saw was real. Every red card was AgntID refusing the call, not my code. Badges are AgntID delegation allowlists. Handoffs are AgntID delegations, and a delegate can't get more access than its parent. The meeting routing is one AgntID check per agent, per sentence. And every decision is in AgntID's audit log.

Next: computer use, where each agent gets its own browser and AgntID decides which sites it can open. Parameter rules: sum of revenue yes, emails and card numbers no. And the right to forget: when you say delete, it's enforced at the tool.

Instinct gave its agent the keys to everything. Give your agents badges, not keys. Thank you.`);
}

pptx.writeFile({ fileName: 'BADGE_AgntID_Pitch.pptx' }).then((f) => console.log('wrote', f));

