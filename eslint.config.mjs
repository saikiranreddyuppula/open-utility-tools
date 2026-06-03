import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';

const disabledReactPluginRules = Object.fromEntries(
  [
    'display-name',
    'jsx-key',
    'jsx-no-comment-textnodes',
    'jsx-no-duplicate-props',
    'jsx-no-target-blank',
    'jsx-no-undef',
    'jsx-uses-react',
    'jsx-uses-vars',
    'no-children-prop',
    'no-danger-with-children',
    'no-deprecated',
    'no-direct-mutation-state',
    'no-find-dom-node',
    'no-is-mounted',
    'no-render-return-value',
    'no-string-refs',
    'no-unescaped-entities',
    'no-unknown-property',
    'no-unsafe',
    'prop-types',
    'react-in-jsx-scope',
    'require-render-return',
  ].map((ruleName) => [`react/${ruleName}`, 'off']),
);

const eslintConfig = [
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    rules: {
      ...disabledReactPluginRules,
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
      'prefer-const': 'warn',
      'react-hooks/preserve-manual-memoization': 'off',
      'react-hooks/immutability': 'off',
      'react-hooks/purity': 'off',
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/static-components': 'off',
      'react-hooks/use-memo': 'off',
    },
  },
  {
    ignores: [
      'out/**',
      '.next/**',
      'rust/**',
      'node_modules/**',
      'lib/registry/registry.generated.ts',
      'packages/core/src/tools/**',
      'packages/core/dist/**',
      'packages/core/docs-api/**',
      'public/sw.js',
    ],
  },
];

export default eslintConfig;
