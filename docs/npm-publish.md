# npm publish from another environment

Malmungchi can be published without logging in to npm on the original VM. Use
one of the flows below from a machine, CI job, or separate repository that has
npm publish rights for the `malmungchi` package.

## Prerequisites

- npm account with permission to publish `malmungchi`
- Bun 1.3 or newer
- npm auth configured in the publishing environment

Check auth first:

```bash
npm whoami
```

## Option A: publish the release tarball

Download the tarball from the GitHub release, then publish that exact artifact:

```bash
gh release download v1.0.0 \
  --repo min9lin9/malmungchi \
  --pattern 'malmungchi-1.0.0.tgz'

npm publish ./malmungchi-1.0.0.tgz --access public
npm view malmungchi version
```

Expected version:

```text
1.0.0
```

## Option B: pack from the git tag

Use this when you want to rebuild the tarball from source in a separate checkout:

```bash
git clone https://github.com/min9lin9/malmungchi.git
cd malmungchi
git checkout v1.0.0
bun install --frozen-lockfile
bun run ci
npm pack
npm publish ./malmungchi-1.0.0.tgz --access public
npm view malmungchi version
```

## CI token pattern

For GitHub Actions or another CI system, store an npm automation token as a
secret and write it to a temporary user npm config during the publish job:

```bash
printf '//registry.npmjs.org/:_authToken=%s\n' "$NPM_TOKEN" > ~/.npmrc
npm publish ./malmungchi-1.0.0.tgz --access public
```

Do not commit `.npmrc`, npm tokens, one-time passwords, or account credentials.
