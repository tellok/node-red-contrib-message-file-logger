# Releasing

This package uses Changesets to manage release notes and package versions.

## Normal flow

1. Add a changeset in feature or fix PRs:

   ```bash
   npm run changeset
   ```

2. Merge the PR into `main`.

3. The `Changeset Version` workflow opens a version PR that updates `package.json`, `package-lock.json`, and `CHANGELOG.md`.

4. Review and merge the version PR.

5. The `Changeset Release` workflow publishes the package to npm when it detects a version change in `package.json`, then creates the matching GitHub release.

## Trusted publishing

After the package exists on npm, configure Trusted Publishing in npm package settings:

1. Open the package on npm and go to Settings.
2. Add a Trusted Publisher for GitHub Actions.
3. Use these values:

   - Organization or user: `tellok`
   - Repository: `node-red-contrib-message-file-logger`
   - Workflow filename: `changeset-publish.yml`
   - Environment name: leave empty unless a GitHub deployment environment is added later
   - Allowed actions: `npm publish`

The release workflow uses OIDC and does not require an npm publish token. It declares `id-token: write` and uses npm 11.5.1 with Node 22.14.0, which are required for npm Trusted Publishing.
