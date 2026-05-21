#!/usr/bin/env bash
# Creates git tags for each codemod whose version was bumped by changesets.
# Outputs the list of changed codemod directories for the publish job.
# Tags follow the pattern: <name>@v<version>
#
# Idempotent: a tag is considered "already released" if it exists locally
# OR on the remote. The local check alone is unreliable on shallow CI
# clones where tags may not be fetched.

set -euo pipefail

# Snapshot remote tags once so we don't run `git ls-remote` per codemod.
remote_tags="$(git ls-remote --tags origin | awk '{print $2}' | sed 's|^refs/tags/||;s|\^{}$||' | sort -u)"

tag_exists_anywhere() {
  local tag="$1"
  if git rev-parse "$tag" >/dev/null 2>&1; then
    return 0
  fi
  if grep -Fxq "$tag" <<<"$remote_tags"; then
    return 0
  fi
  return 1
}

changed_dirs="[]"
new_tags=()

while IFS= read -r codemod_yaml; do
  [ -z "$codemod_yaml" ] && continue
  dir="$(dirname "$codemod_yaml")"
  pkg_json="$dir/package.json"
  if [ ! -f "$pkg_json" ]; then
    echo "Skipping $dir: package.json not found" >&2
    continue
  fi
  name="$(node -p "require('./$pkg_json').name")"
  version="$(node -p "require('./$pkg_json').version")"
  tag="${name}@v${version}"

  if tag_exists_anywhere "$tag"; then
    echo "Tag $tag already exists, skipping"
    continue
  fi

  echo "Creating tag $tag"
  git tag "$tag"
  new_tags+=("$tag")
  changed_dirs="$(echo "$changed_dirs" | node -p "JSON.stringify([...JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')), \"$dir\"])")"
done < <(find codemods -path '*/node_modules/*' -prune -o -name codemod.yaml -print | sort)

for tag in "${new_tags[@]}"; do
  git push origin "refs/tags/$tag"
done

echo "changed_dirs=$changed_dirs" >> "$GITHUB_OUTPUT"
