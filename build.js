import { globSync } from 'glob';
import StyleDictionary from 'style-dictionary';
const tokenFiles = globSync('tokens/**/*.tokens');
const HEADER_COMMENT = `/**
* Do not edit directly, this file was auto-generated.
 */\n\n`;
const myStyleDictionary = new StyleDictionary({
  source: tokenFiles,
  platforms: {
    css_base: {
      transformGroup: 'css',
      buildPath: 'build/css/base/',
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
      buildPath: 'build/css/semantic/',
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
  const semanticTokens = dictionary.allTokens.filter(token => 
    token.filePath.includes('semantic')
  );
  const darkTokens = dictionary.allTokens.filter(token => 
    token.filePath.includes('semantic') && token.filePath.includes('dark')
  );
  const semanticVariables = semanticTokens.map((token) => {
    const { name, comment } = token;
    const baseVariableName = token.original['$value'].replace(/^\{|\}$/g, ''); 
    const cssVariableName = `var(--${baseVariableName.replace(/\./g, '-').replace(/_/g, '-')})`;
    return `  --${name}: ${cssVariableName};${comment ? ` /* ${comment} */` : ''}`;
  }).join('\n');
  const darkVariables = darkTokens.map((token) => {
    const { name, comment } = token;
    const baseVariableName = token.original['$value'].replace(/^\{|\}$/g, ''); 
    const cssVariableName = `var(--${baseVariableName.replace(/\./g, '-').replace(/_/g, '-')})`;
    return `  --${name}: ${cssVariableName};${comment ? ` /* ${comment} */` : ''}`;
  }).join('\n');
  
  return `${HEADER_COMMENT}:root {\n${semanticVariables}\n}\n\n@media (prefers-color-scheme: dark) {\n  :root {\n${darkVariables}\n  }\n}`;
};
myStyleDictionary.buildAllPlatforms();
console.log('Build completed!');
