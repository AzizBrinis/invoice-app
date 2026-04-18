import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["scripts/**/*.cjs"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
  {
    files: ["types/**/*.d.ts"],
    rules: {
      "@typescript-eslint/no-empty-object-type": "off",
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
  {
    files: [
      "src/app/(app)/produits/product-form.tsx",
      "src/app/(app)/site-web/personnalisation-avancee/_components/advanced-customization-client.tsx",
      "src/components/website/cart/cart-context.tsx",
      "src/components/website/templates/ecommerce-ciseco/components/cart/CartDrawer.tsx",
      "src/components/website/templates/ecommerce-ciseco/components/product/ProductDetailPage.tsx",
      "src/components/website/templates/ecommerce-tech-agency.tsx",
    ],
    rules: {
      "react-hooks/set-state-in-effect": "off",
    },
  },
  {
    files: ["src/components/website/templates/ecommerce-tech-agency.tsx"],
    rules: {
      "react-hooks/preserve-manual-memoization": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    ".vercel/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "src/lib/db/**/*.d.ts",
  ]),
]);

export default eslintConfig;
