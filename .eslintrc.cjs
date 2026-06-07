module.exports = {
  root: true,
  env: {
    browser: true,
    es2020: true,
    webextensions: true
  },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    project: ['./tsconfig.json', './tsconfig.node.json']
  },
  plugins: ['@typescript-eslint', 'react-hooks'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended-type-checked',
    'plugin:react-hooks/recommended',
    'prettier'
  ],
  ignorePatterns: ['dist', 'node_modules', '.eslintrc.cjs'],
  rules: {
    '@typescript-eslint/no-misused-promises': [
      'error',
      {
        checksVoidReturn: {
          attributes: false
        }
      }
    ]
  }
};
