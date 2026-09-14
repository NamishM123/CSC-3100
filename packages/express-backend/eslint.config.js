import js from "@eslint/js";
import globals from "globals";

export default [
  { ignores: ["dist"] },
  {
    files: ["**/*.{js}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.node,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module"
      }
    },
    rules: {
      ...js.configs.recommended.rules
    }
  }
];
