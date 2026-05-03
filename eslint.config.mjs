import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import security from 'eslint-plugin-security'
import importPlugin from 'eslint-plugin-import'

const eslintConfig = defineConfig([
  ...nextVitals,

  // ── Security ────────────────────────────────────────────────────────────────
  // Catches obvious footguns: eval, child_process with non-literal args, fs
  // paths from user input, unsafe regex, weak random, etc. Several of these
  // can be noisy on legitimate code — we downgrade those to warn so they show
  // up in CI without blocking PRs.
  {
    plugins: { security },
    rules: {
      'security/detect-bidi-characters': 'error',
      'security/detect-buffer-noassert': 'error',
      'security/detect-child-process': 'error',
      'security/detect-disable-mustache-escape': 'error',
      'security/detect-eval-with-expression': 'error',
      'security/detect-new-buffer': 'error',
      'security/detect-no-csrf-before-method-override': 'error',
      'security/detect-non-literal-fs-filename': 'warn',
      'security/detect-non-literal-regexp': 'warn',
      'security/detect-non-literal-require': 'error',
      'security/detect-object-injection': 'off', // too noisy on legitimate map indexing
      'security/detect-possible-timing-attacks': 'warn',
      'security/detect-pseudoRandomBytes': 'error',
      'security/detect-unsafe-regex': 'warn',
    },
  },

  // ── Import cycles ───────────────────────────────────────────────────────────
  // Static-analysis catch for circular module graphs (which lead to undefined
  // imports at runtime). Other import-plugin rules are skipped to avoid
  // duplicating what eslint-config-next already covers.
  {
    plugins: { import: importPlugin },
    rules: {
      'import/no-cycle': ['error', { maxDepth: 10 }],
      'import/no-self-import': 'error',
    },
  },

  // ── Tighten React hooks deps ────────────────────────────────────────────────
  // exhaustive-deps defaults to warn; promote to error so missed deps in
  // useEffect / useCallback fail CI rather than rotting.
  //
  // set-state-in-effect (new in eslint-config-next 16) is downgraded to warn
  // because the codebase intentionally uses fetch-in-effect with setState
  // (setLoading/setError/setData) — the alternative is a third-party fetcher
  // (SWR / TanStack Query) which is a larger architectural shift. CI surfaces
  // it without blocking; refactor later.
  {
    rules: {
      'react-hooks/exhaustive-deps': 'error',
      'react-hooks/set-state-in-effect': 'warn',
    },
  },

  globalIgnores([
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
    // Skip vendored shadcn UI components from cycle/security rules
    'src/components/ui/**',
  ]),
])

export default eslintConfig
