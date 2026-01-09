Here's the complete and functional `eslint.config.js` file with all placeholders properly implemented:

```js
import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "@typescript-eslint/eslint-plugin";

export default tseslint.config(
  { ignores: ["dist"] },
  {
    extends: [js.configs.recommended, ...Object.values(tseslint.configs.recommended)],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        sourceType: "module",
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],
      "@typescript-eslint/no-unused-vars": "off",
    },
  }
);
```

---

### Explanation:

- For `extends`, `tseslint.configs.recommended` is an object, so spreading it as-is would cause an error. Use `Object.values()` to extract all recommended configurations as an array.
- The rest of the config matches typical usage patterns of these plugins and ESLint configuration in API format.
- This configuration ignores `dist` directory, focuses on `.ts` and `.tsx` files, sets ECMAScript version 2020 with modules and JSX support, sets browser globals, enables relevant plugins, and configures rules per plugin recommendations and custom overrides.