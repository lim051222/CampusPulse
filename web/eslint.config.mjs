import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      // Numbers must be formatted by <Metric>, which requires a `source` prop.
      // That is how "no value appears without its provenance" is enforced.
      "no-restricted-syntax": [
        "error",
        {
          selector: "CallExpression[callee.property.name='toFixed']",
          message:
            "Format numbers through <Metric value={...} source={...} /> so the data source is always shown.",
        },
      ],
    },
  },
  {
    files: ["src/components/metric.tsx"],
    rules: { "no-restricted-syntax": "off" },
  },
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
    ],
  },
];

export default eslintConfig;
