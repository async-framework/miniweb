# Releasing MiniWeb

MiniWeb publishes to npm as `@async/miniweb`.

## Normal Release Flow

MiniWeb uses Release Please. Merge Conventional Commit changes into `main`; the release workflow opens or updates a release PR that bumps `package.json`, updates `package-lock.json`, and updates `CHANGELOG.md`.

When the release PR merges, the workflow creates the GitHub Release, verifies the package, publishes to npm, and attaches the exact packed tarball to the GitHub Release.

## npm Trusted Publishing

Configure npm Trusted Publishing for this package before the first automated publish:

- npm package: `@async/miniweb`
- GitHub owner/repository: `async-framework/miniweb`
- Workflow filename: `release.yml`
- Environment: leave unset unless npm requires one for the package

The workflow uses GitHub OIDC with `id-token: write`; it does not use an `NPM_TOKEN` secret.

## First Release

The first package version is `0.1.0`. After the release automation is pushed and npm Trusted Publishing is configured, create and push the initial tag:

```sh
git tag v0.1.0
git push origin main v0.1.0
```

Then run the `Release` workflow manually with:

```txt
tag: v0.1.0
```

The manual workflow path exists so the first release can publish the already prepared initial version. Future releases should use Release Please PRs.

## Local Verification

Run this before tagging or merging a release PR:

```sh
npm run release:check
```

This runs typecheck, tests, build, and `npm pack --dry-run`.

## Local AI Changelog Polish

AI may be used locally to improve changelog wording before a release PR merges, but it should stay outside the trusted publish workflow. Only feed generated changelog text, public commit subjects, and relevant file lists to the local model. Do not feed secrets, npm config, tokens, environment files, browser profiles, or credential paths into AI tooling.
