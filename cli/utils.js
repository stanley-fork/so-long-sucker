// CLI Utilities

/**
 * Parse command line arguments
 */
export function parseArgs(argv) {
  const args = {
    games: 10,
    parallel: 4,
    provider: 'groq',
    chips: 3,
    output: './data',
    delay: 500,
    headless: false,
    help: false
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = argv[i + 1];

    switch (arg) {
      case '--games':
      case '-g':
        args.games = parseInt(next) || args.games;
        i++;
        break;
      case '--parallel':
      case '-p':
        args.parallel = parseInt(next) || args.parallel;
        i++;
        break;
      case '--provider':
        args.provider = next || args.provider;
        i++;
        break;
      case '--providers':
        args.providers = next || null;
        i++;
        break;
      case '--chips':
      case '-c':
        args.chips = parseInt(next) || args.chips;
        i++;
        break;
      case '--output':
      case '-o':
        args.output = next || args.output;
        i++;
        break;
      case '--delay':
      case '-d':
        args.delay = parseInt(next) || args.delay;
        i++;
        break;
      case '--headless':
        args.headless = true;
        break;
      case '--help':
      case '-h':
        args.help = true;
        break;
    }
  }

  return args;
}

/**
 * ANSI color codes for terminal output
 */
export const COLORS = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',

  // Player colors
  red: '\x1b[91m',
  blue: '\x1b[94m',
  green: '\x1b[92m',
  yellow: '\x1b[93m',

  // UI colors
  white: '\x1b[97m',
  gray: '\x1b[90m',
  cyan: '\x1b[96m',
  magenta: '\x1b[95m',

  // Background
  bgRed: '\x1b[41m',
  bgBlue: '\x1b[44m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgGray: '\x1b[100m'
};

/**
 * Color a string for terminal output
 */
export function colorize(text, color) {
  return `${COLORS[color] || ''}${text}${COLORS.reset}`;
}

/**
 * Get colored chip representation
 */
export function colorChip(color) {
  const symbols = {
    red: colorize('●', 'red'),
    blue: colorize('●', 'blue'),
    green: colorize('●', 'green'),
    yellow: colorize('●', 'yellow')
  };
  return symbols[color] || '○';
}

/**
 * Format milliseconds to readable time
 */
export function formatDuration(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  if (minutes > 0) {
    return `${minutes}m ${remainingSeconds}s`;
  }
  return `${seconds}s`;
}

/**
 * Truncate string with ellipsis
 */
export function truncate(str, maxLen) {
  if (!str) return '';
  if (str.length <= maxLen) return str;
  return str.substring(0, maxLen - 3) + '...';
}

/**
 * Clear terminal screen and move cursor to top
 */
export function clearScreen() {
  // Move to top-left and clear everything below
  process.stdout.write('\x1b[H\x1b[2J\x1b[3J');
}

/**
 * Move cursor to position (1-indexed)
 */
export function moveCursor(row, col) {
  process.stdout.write(`\x1b[${row};${col}H`);
}

/**
 * Hide/show cursor
 */
export function hideCursor() {
  process.stdout.write('\x1b[?25l');
}

export function showCursor() {
  process.stdout.write('\x1b[?25h');
}

/**
 * Enter alternate screen buffer (for full-screen apps)
 */
export function enterAltScreen() {
  process.stdout.write('\x1b[?1049h');
  hideCursor();
}

/**
 * Exit alternate screen buffer
 */
export function exitAltScreen() {
  process.stdout.write('\x1b[?1049l');
  showCursor();
}
