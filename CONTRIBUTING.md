# Contributing to RootLink

Thank you for your interest! RootLink is a community platform for gardeners, makers, tradespeople, and homesteaders. We welcome contributions of all kinds — code, translations, documentation, bug reports, and feature ideas.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Coding Guidelines](#coding-guidelines)
- [Translation (i18n)](#translation-i18n)
- [Pull Request Process](#pull-request-process)
- [Reporting Bugs](#reporting-bugs)
- [Feature Requests](#feature-requests)

## Code of Conduct

This project is governed by the [Contributor Covenant](CODE_OF_CONDUCT.md). By participating, you agree to uphold it.

## Getting Started

1. Fork the repository.
2. Clone your fork:
   ```bash
   git clone https://github.com/YOUR_USERNAME/RootLink.git
   cd RootLink/rootlink
   ```
3. Set up the backend:
   ```bash
   cd backend
   python -m venv .venv
   source .venv/bin/activate
   pip install -r requirements.txt
   ```
4. Set up the frontend:
   ```bash
   cd frontend
   npm install
   ```
5. Start both servers:
   ```bash
   # Terminal 1 — backend (port 8000)
   cd backend && uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

   # Terminal 2 — frontend (port 3000)
   cd frontend && npm run dev
   ```

## Development Workflow

1. Create a branch from `main`:
   ```bash
   git checkout -b feat/my-feature
   # or: fix/my-bug, docs/update-readme, i18n/add-es
   ```
2. Make your changes.
3. Run the relevant checks:
   ```bash
   # Backend
   python -m compileall app/

   # Frontend
   npm run lint
   npx tsc --noEmit
   npm run build
   ```
4. Commit with a clear message:
   ```bash
   git commit -m "feat: add Spanish translation"
   ```
5. Push and open a Pull Request against `main`.

## Coding Guidelines

- **Python**: Follow PEP 8. Use type hints for all function signatures.
- **TypeScript/React**: Use the existing component patterns. Prefer functional components.
- **Imports**: Keep them organised — standard library, third-party, then local.
- **Naming**: Use descriptive names. Avoid abbreviations unless they are universally understood.
- **No commented-out code**: Delete it instead of leaving it commented.

When in doubt, look at the existing code in the same area for style cues.

## Translation (i18n)

RootLink defaults to Portuguese and falls back to English.

1. Add new keys to both `frontend/messages/pt.json` and `frontend/messages/en.json`.
2. Use the `useLocale()` hook and `t()` helper from the existing locale provider.
3. Keep the translation keys organised by page/section (e.g., `calendar_*`, `checklist_*`).

## Pull Request Process

1. Ensure your branch is up to date with `main`.
2. Fill out the [PR template](.github/PULL_REQUEST_TEMPLATE.md).
3. Link any related issues.
4. A maintainer will review your changes.
5. Once approved, your PR will be squash-merged into `main`.

## Reporting Bugs

Open a [bug report issue](https://github.com/RuiSilvaStudio/RootLink/issues/new?labels=bug&template=bug_report.md) with:
- Steps to reproduce
- Expected vs. actual behaviour
- Environment details (OS, browser, commit hash)

## Feature Requests

Open a [feature request issue](https://github.com/RuiSilvaStudio/RootLink/issues/new?labels=enhancement&template=feature_request.md) describing the problem you want to solve and how you envision the solution.

---

*RootLink grows better with every contribution — obrigado!*
