const makePluginImport = (pluginName: string): { identifier: string; packageName: string } => {
  let packageName: string
  const splitted = pluginName.split('/')

  if (pluginName.startsWith('@')) {
    packageName = `${splitted[0]}/eslint-plugin${splitted.length > 1 ? `-${splitted[1]}` : ''}`
  } else {
    packageName = `eslint-plugin-${pluginName}`
  }

  let importIdentifier = pluginName
    .replace(/^@/, '')
    .replaceAll(/[/-]([a-z])/g, (_, letter: string) => letter.toUpperCase())
    .replace(/^([a-z])/, (_, letter: string) => letter.toUpperCase())
    .replaceAll(/[^a-zA-Z0-9]/g, '')

  if (!/^[a-zA-Z]/.test(importIdentifier)) {
    importIdentifier = `plugin${importIdentifier}`
  }

  return { identifier: importIdentifier, packageName }
}

export default makePluginImport
