// Render figures/src/*.jsx (React components that draw SVG) to figures/*.svg.
//   npm install react react-dom typescript   (once)
//   node tools/render_figs.js                (all figures)
//   node tools/render_figs.js fig-1-1        (one figure)
const fs = require('fs');
const path = require('path');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const ts = require('typescript');

const DIR = path.join(__dirname, '..', 'figures');
// Colors used when the SVG is opened on its own (on GitHub, for example).
// Inside the web book the page's own light and dark colors apply instead.
const STANDALONE = '<style>svg:root{font-family:"BIZ UDPGothic","Hiragino Sans","Yu Gothic",sans-serif;' +
  '--cds-text-primary:#17201d;--cds-text-secondary:#4b5954;--cds-chart-axis:#7c8a84;' +
  '--cds-chart-grid:#dbe3df;--cds-chart-reference-tint:#e8efec;--cds-chart-categorical-1:#13795b;' +
  '--cds-chart-categorical-2:#2f6fb0;--cds-chart-categorical-3:#b4691a;--cds-chart-status-good:#1e8a4f;' +
  '--cds-chart-status-warning:#b7791f;--cds-chart-status-critical:#c2412d;background:#fff}</style>';

// One figure uses a small helper component that hands its data rows to a render function.
const claude = {
  Visualize: ({ sources, children }) => children({ rows: sources.rows.data, datum: () => ({}) }),
};

const only = process.argv[2];
const files = fs.readdirSync(path.join(DIR, 'src')).filter(f => f.endsWith('.jsx') && (!only || f === only + '.jsx'));
for (const file of files) {
  const src = fs.readFileSync(path.join(DIR, 'src', file), 'utf8');
  const js = ts.transpileModule(src, {
    compilerOptions: { jsx: ts.JsxEmit.React, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const mod = { exports: {} };
  new Function('React', 'claude', 'module', 'exports', js)(React, claude, mod, mod.exports);
  let svg = renderToStaticMarkup(React.createElement(mod.exports.default))
    .replace(/\sdata-claude-[a-z-]+="[^"]*"/g, '')
    .replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ');
  svg = svg.replace('>', '>' + STANDALONE);
  fs.writeFileSync(path.join(DIR, file.replace(/\.jsx$/, '.svg')), svg + '\n');
  console.log('rendered', file);
}
