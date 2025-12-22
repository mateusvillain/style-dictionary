import { globSync } from 'glob';
import fs from 'fs';
import path from 'path';
import StyleDictionary from 'style-dictionary';

// Register a transform to handle DTCG-style dimension tokens where
// token.original.$value is an object like { value: '8', unit: 'px' }
StyleDictionary.registerTransform({
  name: 'dtcg/format-dimension',
  type: 'value',
  matcher: token => token.type === 'dimension' && token.original && token.original.$value && typeof token.original.$value === 'object',
  transform: token => {
    const v = token.original.$value;
    const valuePart = (v && (v.value !== undefined)) ? String(v.value) : '';
    const unitPart = (v && v.unit) ? String(v.unit) : '';
    return `${valuePart}${unitPart}`;
  }
});

// Name transform: build a kebab-case name from token.path, e.g. ['spacing','0'] -> 'spacing-0'
StyleDictionary.registerTransform({
  name: 'dtcg/name/kebab',
  type: 'name',
  transform: token => {
    if (!token.path || !Array.isArray(token.path)) return token.name || '';
    return token.path.join('-').replace(/\./g, '-').replace(/_/g, '-');
  }
});

// Create a transform group that ensures the DTCG dimension transform runs
// before other transforms. Keep it minimal (only our transform) to avoid
// depending on internal API shape of the library.
StyleDictionary.registerTransformGroup({
  name: 'dtcg/css',
  transforms: ['dtcg/format-dimension', 'dtcg/name/kebab']
});

const tokenFiles = globSync('tokens/**/*.json');
const HEADER_COMMENT = `/**
* Do not edit directly, this file was auto-generated.
 */\n\n`;
const myStyleDictionary = new StyleDictionary({
  source: tokenFiles,
  platforms: {
    text: {
      transformGroup: 'css',
      buildPath: 'build/',
      files: [
        {
          destination: 'text.css',
          format: 'css/variables',
          source: 'tokens/text.json',
          filter: token => token.filePath && token.filePath.includes('text'),
          options: {
            outputReferences: true,
          },
        },
      ],
    },
    dimension: {
      // Use the custom transform group which at minimum applies our DTCG
      // formatter. Keeping the group minimal avoids relying on internal
      // transform lists from the library.
      transformGroup: 'dtcg/css',
      buildPath: 'build/',
      files: [
        {
          destination: 'dimension.css',
          format: 'css/variables',
          source: 'tokens/dimensions.json',
          filter: token => token.filePath && token.filePath.includes('dimensions'),
          options: {
            outputReferences: true,
          },
        },
      ],
    },
    css_semantic: {
      transformGroup: 'css',
      buildPath: 'build/',
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

StyleDictionary.hooks.formats['css/variables-combined'] = function({ dictionary, options }) {
  const { outputReferences } = options;

  // Read semantic token source files directly so we keep both light and dark variants
  const semanticFiles = globSync('tokens/mode/**/*.json');

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
    const cssVariableName = `${baseVariableName}`;
    return `  --${name}: ${cssVariableName};${item.comment ? ` /* ${item.comment} */` : ''}`;
  };

  const semanticVariables = Object.keys(lightMap).map(name => buildVariableLine(name, lightMap[name])).join('\n');
  const darkVariables = Object.keys(darkMap).map(name => buildVariableLine(name, darkMap[name])).join('\n');

  return `${HEADER_COMMENT}:root {\n${semanticVariables}\n}\n\n@media (prefers-color-scheme: dark) {\n  :root {\n${darkVariables}\n  }\n}`;
};

myStyleDictionary.buildAllPlatforms();
console.log('Build completed!');
