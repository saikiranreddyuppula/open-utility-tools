# Changesets

This folder is managed by [Changesets](https://github.com/changesets/changesets). It tracks intended releases for the publishable packages in this repo (currently `@open-utility-tools/core`; the private root app is ignored).

Add a changeset for any change that should ship to npm:

```sh
bunx changeset
```

Pick the package(s), the semver bump (patch/minor/major), and write a summary — it becomes the changelog entry. On release, `bunx changeset version` applies the bumps and `bunx changeset publish` publishes (wired into CI).
