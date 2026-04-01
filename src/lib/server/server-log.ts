export default function initServerLogging() {
  if ((global as any).__consoleMethodsOverridden__) {
    return;
  }
  (global as any).__consoleMethodsOverridden__ = true;

  const oldLog = console.log;
  const oldDebug = console.debug;
  const oldError = console.error;
  const oldWarn = console.warn;

  const getTimestamp = () => new Date().toISOString();

  const colors = {
    reset: "\x1b[0m",
    blue: "\x1b[34m",
    green: "\x1b[32m",
    red: "\x1b[31m",
    yellow: "\x1b[33m",
  };

  console.log = function (...args) {
    oldLog.apply(console, [`${colors.blue}${getTimestamp()} ${colors.reset}`, ...args]);
  };

  console.debug = function (...args) {
    oldDebug.apply(console, [`${colors.green}${getTimestamp()} ${colors.reset}`, ...args]);
  };

  console.error = function (...args) {
    oldError.apply(console, [`${colors.red}${getTimestamp()} ${colors.reset}`, ...args]);
  };

  console.warn = function (...args) {
    oldWarn.apply(console, [`${colors.yellow}${getTimestamp()} ${colors.reset}`, ...args]);
  };
}
