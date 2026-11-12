import { defineConfig } from 'eslint/config'
import tseslint from 'typescript-eslint'

export default defineConfig([
  {
    files: ['src/**/*.{ts,tsx}'],
    extends: [tseslint.configs.recommended],
    rules: {
      // Numbers may only be formatted inside <MetricValue>, which requires a `source`
      // prop. That is how "every displayed value carries its data source" is enforced.
      'no-restricted-syntax': [
        'error',
        {
          selector: "CallExpression[callee.property.name='toFixed']",
          message:
            'Format numbers through <MetricValue value={...} source={...} /> so the data source is always displayed.',
        },
      ],
    },
  },
  {
    files: ['src/components/MetricValue.tsx'],
    rules: { 'no-restricted-syntax': 'off' },
  },
])
