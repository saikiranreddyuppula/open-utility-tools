/** Curated .gitignore templates, assembled client-side. */

export const GITIGNORE_TEMPLATES: Record<string, string> = {
  Node: `node_modules/
npm-debug.log*
yarn-debug.log*
yarn-error.log*
.pnpm-debug.log*
.npm
.env
.env.local
dist/
build/
coverage/
.cache/`,
  Python: `__pycache__/
*.py[cod]
*$py.class
.Python
env/
venv/
.venv/
*.egg-info/
.pytest_cache/
.mypy_cache/
.coverage
dist/
build/`,
  Rust: `/target
**/*.rs.bk
Cargo.lock
*.pdb`,
  Go: `*.exe
*.test
*.out
/bin/
/vendor/
go.work`,
  Java: `*.class
*.jar
*.war
target/
.gradle/
build/
.idea/
*.iml`,
  macOS: `.DS_Store
.AppleDouble
.LSOverride
._*
.Spotlight-V100
.Trashes`,
  Windows: `Thumbs.db
ehthumbs.db
Desktop.ini
$RECYCLE.BIN/
*.lnk`,
  Linux: `*~
.fuse_hidden*
.directory
.Trash-*`,
  VSCode: `.vscode/*
!.vscode/extensions.json
!.vscode/settings.json
*.code-workspace`,
  JetBrains: `.idea/
*.iml
*.iws
out/`,
  Next: `.next/
out/
next-env.d.ts
.vercel`,
};
