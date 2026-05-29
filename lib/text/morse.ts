/** International Morse code mapping + encode/decode. */

const MAP: Record<string, string> = {
  A: '.-', B: '-...', C: '-.-.', D: '-..', E: '.', F: '..-.', G: '--.', H: '....',
  I: '..', J: '.---', K: '-.-', L: '.-..', M: '--', N: '-.', O: '---', P: '.--.',
  Q: '--.-', R: '.-.', S: '...', T: '-', U: '..-', V: '...-', W: '.--', X: '-..-',
  Y: '-.--', Z: '--..',
  '0': '-----', '1': '.----', '2': '..---', '3': '...--', '4': '....-',
  '5': '.....', '6': '-....', '7': '--...', '8': '---..', '9': '----.',
  '.': '.-.-.-', ',': '--..--', '?': '..--..', "'": '.----.', '!': '-.-.--',
  '/': '-..-.', '(': '-.--.', ')': '-.--.-', '&': '.-...', ':': '---...',
  ';': '-.-.-.', '=': '-...-', '+': '.-.-.', '-': '-....-', '_': '..--.-',
  '"': '.-..-.', '$': '...-..-', '@': '.--.-.',
};
const REVERSE: Record<string, string> = Object.fromEntries(
  Object.entries(MAP).map(([k, v]) => [v, k])
);

export function textToMorse(text: string): string {
  return text
    .toUpperCase()
    .split('\n')
    .map((line) =>
      line
        .split(/\s+/)
        .map((word) =>
          word
            .split('')
            .map((ch) => MAP[ch] ?? '')
            .filter(Boolean)
            .join(' ')
        )
        .join(' / ')
    )
    .join('\n');
}

export function morseToText(morse: string): string {
  return morse
    .trim()
    .split('\n')
    .map((line) =>
      line
        .split('/')
        .map((word) =>
          word
            .trim()
            .split(/\s+/)
            .map((code) => REVERSE[code] ?? '')
            .join('')
        )
        .join(' ')
    )
    .join('\n');
}
