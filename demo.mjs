/**
 * demo.mjs
 * --------
 * A command-line script that runs the maths engine for any name
 * and prints all the calculations to the terminal.
 *
 * USAGE:
 *   node demo.mjs Maya
 *   node demo.mjs "Maya Patel"
 *   node demo.mjs JOHN
 *   node demo.mjs ABCDEFGHIJKLMNOPQRSTUVWXYZ
 *
 * This is NOT part of the website — it is a quick way to see
 * the maths working before the full UI is built.
 */

// ─── Inline the core maths (mirrors mathEngine.ts exactly) ───────────────────

const H_MODULUS = 997;
const T_MODULUS = 10007;
const FIB_STEPS = 16;
const GENRE_COUNT = 4;

const GENRE_CONFIGS = {
  0: { name: 'Drama',   minBPM: 50,  maxBPM: 110 },
  1: { name: 'Comedy',  minBPM: 80,  maxBPM: 145 },
  2: { name: 'Horror',  minBPM: 40,  maxBPM: 120 },
  3: { name: 'Action',  minBPM: 110, maxBPM: 180 },
};

const LETTER_SOUND_NAMES = {
  A:'snap', B:'clap', C:'tongue-click', D:'foot-stomp', E:'short-whistle',
  F:'sharp-inhale', G:'sigh', H:'thigh-slap', I:'lip-pop', J:'hum',
  K:'double-snap', L:'double-clap', M:'two-tongue-clicks', N:'two-foot-stomps',
  O:'long-whistle', P:'long-exhale', Q:'sniffle', R:'laugh', S:'cough',
  T:'grunt', U:'gasp', V:'lip-trill', W:'whispered-whoo', X:'chest-thump',
  Y:'sneeze', Z:'sobbing-breath',
};

function normalizeName(input) {
  return input.toUpperCase().replace(/[^A-Z]/g, '');
}

function letterToValue(letter) {
  return letter.charCodeAt(0) - 64;
}

function fibonacciModulo(n) {
  if (n === 1) return Array(FIB_STEPS).fill(0);
  const seq = new Array(FIB_STEPS);
  seq[0] = 0; seq[1] = 1;
  for (let k = 2; k < FIB_STEPS; k++) seq[k] = (seq[k-1] + seq[k-2]) % n;
  return seq;
}

function generateResult(rawInput) {
  const normalizedName = normalizeName(rawInput);
  if (!normalizedName) throw new Error(`No letters found in: "${rawInput}"`);

  const letters = normalizedName.split('').map((letter, idx) => {
    const value = letterToValue(letter);
    return { letter, position: idx + 1, value, fibSequence: fibonacciModulo(value) };
  });

  const letterSum = letters.reduce((s, l) => s + l.value, 0);

  const weightedSum = letters.reduce((s, l) => s + l.position * l.value, 0);
  const genreFingerprint = weightedSum % H_MODULUS;
  const genreIndex = genreFingerprint % GENRE_COUNT;

  const tempoWeightedSum = letters.reduce((s, l) => s + l.position * l.value * l.value, 0);
  const tempoFingerprint = tempoWeightedSum % T_MODULUS;
  const genre = GENRE_CONFIGS[genreIndex];
  const bpmRangeSize = genre.maxBPM - genre.minBPM + 1;
  const bpmOffset = tempoFingerprint % bpmRangeSize;
  const bpm = genre.minBPM + bpmOffset;

  return {
    rawInput, normalizedName, letters, letterSum,
    genreFingerprint, genreIndex, genre: genre.name,
    tempoFingerprint, bpm,
    calculationSteps: { weightedSum, tempoWeightedSum, bpmOffset, bpmRangeSize },
  };
}

// ─── Print the result ─────────────────────────────────────────────────────────

const input = process.argv.slice(2).join(' ') || 'MAYA';
const result = generateResult(input);
const genreConf = GENRE_CONFIGS[result.genreIndex];
const sep = '─'.repeat(66);

console.log('\n' + sep);
console.log('  🎵  THE SOUND OF A NAME — Maths Engine Demo');
console.log(sep);
console.log(`  Input      : "${result.rawInput}"`);
console.log(`  Normalized : "${result.normalizedName}"`);
console.log(sep);

console.log('\n  LETTER VALUES');
const headerRow  = result.letters.map(l => l.letter.padStart(4)).join('');
const valuesRow  = result.letters.map(l => String(l.value).padStart(4)).join('');
const soundRow   = result.letters.map(l => (LETTER_SOUND_NAMES[l.letter] || '?').slice(0,4).padStart(4)).join('');
console.log('  Letter : ' + headerRow);
console.log('  Value  : ' + valuesRow);
console.log(`\n  Letter Sum  = ${result.letters.map(l=>l.value).join(' + ')} = ${result.letterSum}`);

console.log('\n  GENRE CALCULATION');
console.log(`  Weighted sum  Σ (i × xᵢ)   = ${result.calculationSteps.weightedSum}`);
console.log(`  H = ${result.calculationSteps.weightedSum} mod 997 = ${result.genreFingerprint}`);
console.log(`  Genre index   = ${result.genreFingerprint} mod 4 = ${result.genreIndex}  →  ${result.genre.toUpperCase()}`);

console.log('\n  TEMPO CALCULATION');
console.log(`  Weighted sum  Σ (i × xᵢ²)  = ${result.calculationSteps.tempoWeightedSum}`);
console.log(`  T = ${result.calculationSteps.tempoWeightedSum} mod 10007 = ${result.tempoFingerprint}`);
console.log(`  ${result.genre} BPM range : ${genreConf.minBPM}–${genreConf.maxBPM}  (${result.calculationSteps.bpmRangeSize} possible values)`);
console.log(`  BPM offset    = ${result.tempoFingerprint} mod ${result.calculationSteps.bpmRangeSize} = ${result.calculationSteps.bpmOffset}`);
console.log(`  BPM           = ${genreConf.minBPM} + ${result.calculationSteps.bpmOffset} = ${result.bpm}`);

console.log('\n  FIBONACCI-MODULO SEQUENCES (16 steps per letter)');
for (const l of result.letters) {
  const sound = LETTER_SOUND_NAMES[l.letter] || '?';
  const note  = l.value === 1 ? '  ← all zeros (n=1 special case: silence)' : '';
  console.log(`\n  ${l.letter} (value=${l.value}, sound="${sound}")`);
  console.log(`    [${l.fibSequence.join(', ')}]${note}`);
}

console.log('\n' + sep);
console.log(`  RESULT:  "${result.normalizedName}"  →  ${result.genre.toUpperCase()},  ${result.bpm} BPM`);
console.log(sep + '\n');
