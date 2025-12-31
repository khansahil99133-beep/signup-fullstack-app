module.exports = {
  root: true,
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: "module"
  },
  env: {
    es2021: true
  },
  overrides: [
    {
      files: ["backend/**/*.js"],
      env: {
        node: true,
        es2021: true
      },
      parserOptions: {
        ecmaVersion: 2020,
        sourceType: "module"
      },
      plugins: ["node"],
      extends: ["eslint:recommended", "plugin:node/recommended"],
      rules: {
        "node/no-missing-import": "off",
        "node/no-unsupported-features/es-syntax": "off",
        "node/no-unsupported-features/node-builtins": "off",
        "no-unused-vars": ["error", { varsIgnorePattern: "^_" }]
      }
    },
    {
      files: ["frontend/**/*.ts", "frontend/**/*.tsx"],
      env: {
        browser: true,
        es2021: true
      },
      parser: "@typescript-eslint/parser",
      plugins: ["@typescript-eslint", "react", "react-hooks", "jsx-a11y", "import"],
      extends: [
        "eslint:recommended",
        "plugin:@typescript-eslint/recommended",
        "plugin:react/recommended",
        "plugin:react-hooks/recommended",
        "plugin:jsx-a11y/recommended",
        "plugin:import/recommended",
        "plugin:import/typescript",
        "plugin:prettier/recommended"
      ],
      settings: {
        react: {
          version: "detect"
        }
      },
      rules: {
        "react/react-in-jsx-scope": "off",
        "react/prop-types": "off",
        "@typescript-eslint/explicit-function-return-type": "off"
      }
    }
  ]
};
