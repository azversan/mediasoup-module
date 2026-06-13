# Contributing to @azversan/mediasoup

Thank you for your interest in contributing! This document covers everything you need to get started.

- [Contributing to @azversan/mediasoup](#contributing-to-azversanmediasoup)
  - [Code of Conduct](#code-of-conduct)
  - [Getting Started](#getting-started)
  - [Development Setup](#development-setup)
    - [Prerequisites](#prerequisites)
    - [Install Dependencies](#install-dependencies)
    - [Available Scripts](#available-scripts)
  - [Project Structure](#project-structure)
  - [Making Changes](#making-changes)
    - [Branch Naming](#branch-naming)
    - [Coding Guidelines](#coding-guidelines)
    - [Linting \& Formatting](#linting--formatting)
  - [Commit Convention](#commit-convention)
  - [Pull Request Process](#pull-request-process)
  - [Reporting Bugs](#reporting-bugs)
  - [Requesting Features](#requesting-features)
  - [Questions](#questions)

## Code of Conduct

By participating in this project, you agree to be respectful and constructive in all interactions. Harassment, discrimination, or hostile behavior of any kind will not be tolerated.

## Getting Started

1. **Fork** the repository on GitHub.
2. **Clone** your fork locally:
   ```bash
   git clone https://github.com/<your-username>/mediasoup-module.git
   cd mediasoup-module
   ```
3. **Add the upstream remote:**
   ```bash
   git remote add upstream https://github.com/azversan/mediasoup-module.git
   ```

## Development Setup

### Prerequisites

| Tool    | Version |
| ------- | ------- |
| Node.js | `>= 18` |
| npm     | `>= 9`  |

> mediasoup requires native compilation — ensure your system has a C++ build toolchain (`build-essential` on Linux, Xcode CLI on macOS, or Visual Studio Build Tools on Windows).

### Install Dependencies

```bash
npm install
```

### Available Scripts

| Script                | Description                           |
| --------------------- | ------------------------------------- |
| `npm run build`       | Compile the library with `tsup`       |
| `npm run build:watch` | Watch mode build                      |
| `npm run lint`        | Run ESLint with auto-fix              |
| `npm run format`      | Format all source files with Prettier |
| `npm test`            | Run unit tests                        |
| `npm run test:watch`  | Run tests in watch mode               |
| `npm run test:cov`    | Run tests with coverage report        |

## Project Structure

```text
src/
├── mediasoup/
│   ├── services/
│   │   ├── mediasoup/         # MediasoupService — primary API
│   │   └── observer/          # ObserverService — event wiring & telemetry
│   ├── mediasoup.constant.ts  # Shared mediasoup type constants
│   ├── mediasoup.decorator.ts # @OnMediasoup decorator
│   ├── mediasoup.exception.ts # MediasoupException class
│   ├── mediasoup.interface.ts # All types, interfaces, and event maps
│   ├── mediasoup.module.ts    # NestJS dynamic module
│   └── mediasoup.provider.ts  # DI providers (store, worker index)
└── index.ts                   # Public API entry point
```

## Making Changes

### Branch Naming

Create a branch from `develop` (not `main`):

```bash
git checkout develop
git pull upstream develop
git checkout -b <type>/<short-description>
```

| Type        | When to use                              |
| ----------- | ---------------------------------------- |
| `feat/`     | New feature or enhancement               |
| `fix/`      | Bug fix                                  |
| `docs/`     | Documentation only                       |
| `refactor/` | Code restructure without behavior change |
| `test/`     | Adding or updating tests                 |
| `chore/`    | Tooling, dependencies, CI                |

**Examples:** `feat/pipe-transport-helper`, `fix/worker-port-offset`, `docs/readme-webrtc-server`

### Coding Guidelines

- **TypeScript strict** — do not disable `noImplicitAny` or `strictNullChecks` in new code.
- **JSDoc** — all public methods on `MediasoupService` must have JSDoc comments (description, `@param`, `@returns`, `@throws`).
- **AppData schemas** — any new mediasoup resource must carry typed `appData` defined in `mediasoup.interface.ts`.
- **Events** — new lifecycle events must be added to the relevant `*EventMap` interface and the `MediasoupEventMap` union.
- **Exceptions** — always throw `MediasoupException` (never raw `Error`) for domain errors.
- **No side effects in constructors** — keep `constructor()` assignment-only; initialization belongs in `onApplicationBootstrap`.

### Linting & Formatting

Run before committing:

```bash
npm run lint
npm run format
```

The CI pipeline will fail if lint or Prettier checks do not pass.

## Commit Convention

This project follows [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <short summary>

[optional body]

[optional footer(s)]
```

**Types:** `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `perf`, `ci`

**Scopes:** `service`, `observer`, `module`, `provider`, `interface`, `decorator`, `exception`, `ci`, `deps`

**Examples:**

```
feat(service): add pipeToRouter helper method
fix(observer): move listenererror to WebRtcServer instance instead of observer
docs(interface): add JSDoc for createDataConsumer and createDataProducer
chore(ci): pin actions/checkout and actions/setup-node to v4
```

> Commits that do not follow this format will be flagged during code review.

## Pull Request Process

1. **Ensure all checks pass** locally before opening a PR:

   ```bash
   npm run lint && npm run test:cov && npm run build
   ```

2. **Target the `develop` branch** — PRs against `main` will be redirected.

3. **Fill in the PR template** completely. PRs with empty descriptions will not be reviewed.

4. **Keep PRs focused** — one logical change per PR. Large PRs should be discussed in an Issue first.

5. **Tests are required** for any new `MediasoupService` or `ObserverService` method. PRs without tests for new behavior will not be merged.

6. **Update JSDoc** for any changed or new public method.

7. A maintainer will review your PR. Please address all review comments before requesting re-review.

8. Once approved and CI passes, a maintainer will merge your PR.

## Reporting Bugs

Use the [Bug Report template](.github/ISSUE_TEMPLATE/bug_report.yml) on GitHub Issues.

Please include:

- Package version (`npm list @azversan/mediasoup`)
- Node.js version (`node --version`)
- NestJS and mediasoup versions
- Operating system
- Minimal reproduction steps
- Expected vs. actual behavior
- Relevant logs or stack traces

Issues without a reproduction case may be closed without resolution.

## Requesting Features

Use the [Feature Request template](.github/ISSUE_TEMPLATE/feature_request.yml) on GitHub Issues.

A good feature request includes:

- The problem you are trying to solve
- Your proposed API shape (TypeScript snippet if possible)
- Alternatives you have considered

Large or breaking features should be discussed in a GitHub Discussion before submitting a PR.

## Questions

For usage questions, architecture questions, or anything that is not a bug or feature request, please open a [Question issue](.github/ISSUE_TEMPLATE/question.yml) or start a [GitHub Discussion](https://github.com/azversan/mediasoup-module/discussions).
