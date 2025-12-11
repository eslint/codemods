find . -type f \( -name '.eslintrc.js' -o -name '.eslintrc.json' -o -name '.eslintrc.yaml' -o -name '.eslintrc.yml' \) | while read file; do
  new_path="$(dirname "${file}")/eslint.config.mjs"
  if [[ -e "${new_path}" ]]; then
    echo "❌ ${new_path} already exists. Skipping moving ${file}."
    continue
  fi
  mv "${file}" "${new_path}"
  echo "✅ Moved ${file} -> ${new_path}"
done
