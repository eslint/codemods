# Use CODEMOD_TARGET_PATH (set by codemod CLI when using -t/--target), or current directory
TARGET_DIR="${CODEMOD_TARGET_PATH:-.}"
find "$TARGET_DIR" -type f \( -name '.eslintrc.js' -o -name '.eslintrc.json' -o -name '.eslintrc.yaml' -o -name '.eslintrc.yml' -o -name '.eslintrc.cjs' -o -name '.eslintrc.mjs' \) | while read file; do
  dir=$(dirname "$file")
  new_path="${dir}/eslint.config.mjs"
  if [[ -e "${new_path}" ]]; then
    echo "❌ ${new_path} already exists. Skipping moving ${file}."
    continue
  fi
  mv "$file" "$new_path"
  echo "✅ Moved $file -> $new_path"
  # install prettier using npm and run prettier for eslint.config.mjs
done
