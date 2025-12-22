import { globSync } from 'glob';
import fs from 'fs';
import path from 'path';
import StyleDictionary from 'style-dictionary';
// ...existing code...
const tokenFiles = globSync('tokens/**/*.tokens');
const HEADER_COMMENT = `/**
* Do not edit directly, this file was auto-generated.
 */\n\n`;
const myStyleDictionary = new StyleDictionary({
  source: tokenFiles,
  platforms: {
    css_base: {
      transformGroup: 'css',
      buildPath: 'build/base/',
      files: [
        {
          destination: 'colors.css',
          format: 'css/variables',
          filter: (token) => token.filePath.includes('base'),
        },
      ],
    },
    css_semantic: {
      transformGroup: 'css',
      buildPath: 'build/semantic/',
      files: [
        {
          destination: 'colors.css',
          format: 'css/variables-combined',
          options: {
            outputReferences: true,
          },
        },
      ],
    },
  },
});
// ...existing code...
StyleDictionary.hooks.formats['css/variables-combined'] = function({ dictionary, options }) {
  const { outputReferences } = options;

  // Read semantic token source files directly so we keep both light and dark variants
  const semanticFiles = globSync('tokens/semantic/**/*.tokens');

  const lightFiles = semanticFiles.filter(p => !p.includes('dark'));
  const darkFiles = semanticFiles.filter(p => p.includes('dark'));

  const flattenTokens = (obj, prefix = [], out = {}) => {
    Object.keys(obj).forEach((key) => {
      const value = obj[key];
      if (value && typeof value === 'object' && ('$value' in value)) {
        const name = [...prefix, key].join('-');
        out[name] = {
          value: value['$value'],
          comment: value['$description'] || value['$comment'] || ''
        };
      } else if (value && typeof value === 'object') {
        flattenTokens(value, [...prefix, key], out);
      }
    });
    return out;
  };

  const loadFilesToMap = (files) => {
    const map = {};
    files.forEach((fp) => {
      try {
        const content = fs.readFileSync(fp, 'utf8');
        const parsed = JSON.parse(content);
        Object.assign(map, flattenTokens(parsed));
      } catch (e) {
        // ignore parse errors for non-json files
      }
    });
    return map;
  };

  const lightMap = loadFilesToMap(lightFiles);
  const darkMap = loadFilesToMap(darkFiles);

  const buildVariableLine = (name, item) => {
    const baseVariableName = String(item.value).replace(/^\{|\}$/g, '').replace(/\./g, '-').replace(/_/g, '-');
    const cssVariableName = `var(--${baseVariableName})`;
    return `  --${name}: ${cssVariableName};${item.comment ? ` /* ${item.comment} */` : ''}`;
  };

  const semanticVariables = Object.keys(lightMap).map(name => buildVariableLine(name, lightMap[name])).join('\n');
  const darkVariables = Object.keys(darkMap).map(name => buildVariableLine(name, darkMap[name])).join('\n');

  return `${HEADER_COMMENT}:root {\n${semanticVariables}\n}\n\n@media (prefers-color-scheme: dark) {\n  :root {\n${darkVariables}\n  }\n}`;
};
// ...existing code...
myStyleDictionary.buildAllPlatforms();
console.log('Build completed!');
