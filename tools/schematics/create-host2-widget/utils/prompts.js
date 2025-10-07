// Optional prompts utility for promptAll mode
let inquirer;
try {
  // Try CommonJS require first
  inquirer = require('inquirer');
  // Some distributions export the prompt function as default
  if (inquirer && typeof inquirer === 'object' && typeof inquirer.default === 'function' && !inquirer.prompt) {
    inquirer.prompt = inquirer.default;
  }
} catch (e) {
  try {
  // Attempt dynamic import for ESM case
    const dynamicImport = new Function('m', 'return import(m);');
    // We cannot await at top-level; store a promise and handle later
    inquirer = { __pending: dynamicImport('inquirer') };
  } catch (_e) {
    // Leave undefined; we'll guard later
  }
}

const OPTIONAL_META = [
  // Service-related (skip entirely if registerWidget === 'no')
  { key: 'description', type: 'string', message: 'Short description for Add Widget dialog:', serviceRelated: true },
  { key: 'icon', type: 'string', message: 'Specify the Icon key (the SVG id to be used) as found in /assets/svg/icons.svg (or used the default placeholder string):', serviceRelated: true },
  { key: 'minWidth', type: 'number', message: 'Min grid width:', serviceRelated: true },
  { key: 'minHeight', type: 'number', message: 'Min grid height:', serviceRelated: true },
  { key: 'defaultWidth', type: 'number', message: 'Default width:', serviceRelated: true },
  { key: 'defaultHeight', type: 'number', message: 'Default height:', serviceRelated: true },
  // Non-service
  { key: 'pathKey', type: 'string', message: 'Primary path key:' },
  { key: 'pathDescription', type: 'string', message: 'Path description:' },
  { key: 'pathType', type: 'enum', choices: ['number','string','boolean','Date'], message: 'Path type:' },
  { key: 'pathDefault', type: 'string', message: 'Path default (blank = null):', allowNull: true },
  { key: 'convertUnitTo', type: 'string', message: 'Convert unit to (blank = none):', allowNull: true },
  { key: 'sampleTime', type: 'number', message: 'Sample time (ms):' },
  { key: 'pathRequired', type: 'boolean', message: 'Is path required?' },
  { key: 'isPathConfigurable', type: 'boolean', message: 'Is path user configurable?' },
  { key: 'showPathSkUnitsFilter', type: 'boolean', message: 'Show SK units filter?' },
  { key: 'pathSkUnitsFilter', type: 'string', message: 'SK units filter (blank = none):', allowNull: true },
  { key: 'enableTimeout', type: 'boolean', message: 'Enable timeout?' },
  { key: 'dataTimeout', type: 'number', message: 'Timeout seconds:' },
  { key: 'ignoreZones', type: 'boolean', message: 'Ignore zones metadata?' },
  { key: 'displayNameOpt', type: 'string', message: 'Config display name (optional):' },
  { key: 'color', type: 'string', message: 'Theme color role:' },
  { key: 'addSpec', type: 'boolean', message: 'Generate spec file?' },
  { key: 'todoBlock', type: 'boolean', message: 'Include TODO block?' },
  { key: 'readme', type: 'boolean', message: 'Generate README?' }
];

async function promptForOptional(options, ctx) {
  const debug = !!options.debugLogging;
  if (!options.__fullPrompt) {
    if (debug && ctx && ctx.logger) ctx.logger.info('[widget-schematic] promptAll disabled; skipping optional prompts.');
    return options; // Skip optional prompts
  }
  if (!process.stdout.isTTY) {
    ctx && ctx.logger && ctx.logger.warn('Interactive true but no TTY detected; skipping optional prompts.');
    return options;
  }
  if (debug && ctx && ctx.logger) ctx.logger.info('[widget-schematic] Building optional prompts (registerWidget=' + options.registerWidget + ').');
  // Resolve pending dynamic import if needed
  if (inquirer && inquirer.__pending) {
    try {
      const mod = await inquirer.__pending;
      // Prefer default if present (ESM build)
      inquirer = mod && (mod.default || mod);
      // Ensure prompt function is attached (ESM sometimes exports directly)
      if (typeof inquirer === 'function' && !inquirer.prompt) {
        inquirer = { prompt: inquirer };
      } else if (inquirer && typeof inquirer.default === 'function' && !inquirer.prompt) {
        inquirer.prompt = inquirer.default;
      }
      if (debug && ctx && ctx.logger) {
        ctx.logger.info('[widget-schematic] inquirer module resolved; keys=' + Object.keys(inquirer || {}).join(','));
      }
    } catch (e) {
      if (debug && ctx && ctx.logger) ctx.logger.warn('[widget-schematic] Failed dynamic import of inquirer; skipping optional prompts. ' + e.message);
      return options;
    }
  }
  // Additional fallback: attempt late require with explicit paths
  if ((!inquirer || typeof inquirer.prompt !== 'function') && debug) {
    const candidates = [];
    try { candidates.push(require('inquirer')); } catch(_) {}
    try { candidates.push(require(require.resolve('inquirer', { paths: [process.cwd()] }))); } catch(_) {}
    for (const cand of candidates) {
      if (!cand) continue;
      const resolved = (cand.default && typeof cand.default === 'function') ? { prompt: cand.default } : cand;
      if (typeof resolved === 'function' && !resolved.prompt) {
        inquirer = { prompt: resolved };
        break;
      }
      if (resolved && typeof resolved.prompt === 'function') {
        inquirer = resolved;
        break;
      }
    }
    if (inquirer && typeof inquirer.prompt === 'function') {
      ctx.logger.info('[widget-schematic] inquirer recovered via fallback strategy.');
    }
  }
  if (!inquirer || typeof inquirer.prompt !== 'function') {
    if (debug && ctx && ctx.logger) ctx.logger.warn('[widget-schematic] inquirer not available; skipping optional prompts.');
    return options;
  }
  const questions = OPTIONAL_META
    // Always prompt in interactive mode (except elements explicitly skipped)
    .filter(meta => !(options.registerWidget === 'no' && meta.serviceRelated))
    .map(meta => {
      if (meta.type === 'enum') return { name: meta.key, type: 'list', message: meta.message, choices: meta.choices, default: options[meta.key] };
      if (meta.type === 'boolean') return { name: meta.key, type: 'confirm', message: meta.message, default: options[meta.key] ?? false };
      if (meta.type === 'number') return { name: meta.key, type: 'input', message: meta.message, default: options[meta.key], validate: v => v === '' || !isNaN(Number(v)) || 'Enter a number' };
      return { name: meta.key, type: 'input', message: meta.message, default: options[meta.key] };
    });

  if (debug && ctx && ctx.logger) ctx.logger.info('[widget-schematic] Prepared ' + questions.length + ' prompt questions.');

  if (!questions.length) return options;
  const answers = await inquirer.prompt(questions);
  if (debug && ctx && ctx.logger) ctx.logger.info('[widget-schematic] Answers received: ' + JSON.stringify(answers));
  OPTIONAL_META.forEach(meta => {
    if (!(meta.key in answers)) return;
    let v = answers[meta.key];
    if (meta.type === 'number') v = v === '' ? undefined : Number(v);
    if (meta.allowNull && (v === '' || v === undefined)) v = null;
    options[meta.key] = v;
  });
  if (debug && ctx && ctx.logger) ctx.logger.info('[widget-schematic] Options after merging answers: ' + JSON.stringify(options));
  return options;
}

module.exports = { promptForOptional };
