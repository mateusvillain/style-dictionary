import { globSync } from 'glob';
import StyleDictionary from 'style-dictionary';
const tokenFiles = globSync('tokens/**/*.json');
const HEADER_COMMENT = `/**
 * Do not edit directly, this file was auto-generated.
 */\n\n`;
const myStyleDictionary = new StyleDictionary({
  source: tokenFiles,
  platforms: {
    css_semantic: {
      transformGroup: 'css',
      buildPath: 'build/',
      files: [
        {
          destination: 'colors.css',
          format: 'css/variables',
          filter: (token) => token.filePath.includes('base'),
          options: {
            outputReferences: true,
          },
        },
        {
          destination: 'colors.dark.css',
          format: 'css/variables-dark',
          filter: (token) => token.filePath.includes('base') && token.filePath.includes('dark'),
          options: {
            outputReferences: true,
          },
        },
      ],
    },
  },
});
StyleDictionary.hooks.formats['css/variables-dark'] = function({ dictionary, options }) {
  const { outputReferences } = options;
  const darkTokens = dictionary.allTokens.filter(token => 
    token.filePath.includes('base') && token.filePath.includes('dark')
  );
  const tokens = darkTokens.map((token) => {
    const { name } = token;
    const baseVariableName = token.original['$value'].replace(/^\{|\}$/g, ''); // Remove curly braces
    const cssVariableName = `${baseVariableName}`;
    const description = token.original.$description;
    return `  --${name}: ${cssVariableName};${description ? ` /* ${description} */` : ''}`;
  }).join('\n');
  return `${HEADER_COMMENT}@media (prefers-color-scheme: dark) {\n  :root {\n${tokens}\n  }\n}`;
};
myStyleDictionary.buildAllPlatforms();
console.log('Build completed!');
