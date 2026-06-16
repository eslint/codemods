export const ESLINT_RECOMMENDED_V9_NEW_RULES = [
  'no-constant-binary-expression',
  'no-empty-static-block',
  'no-new-native-nonconstructor',
  'no-unused-private-class-members',
] as const

export const preserveV8RecommendedRuleOverrides = (
  rules: Record<string, string>,
  extendsPresets: string[],
): Record<string, string> => {
  if (!extendsPresets.includes('eslint:recommended')) {
    return rules
  }

  const nextRules = { ...rules }

  for (const ruleName of ESLINT_RECOMMENDED_V9_NEW_RULES) {
    if (!(ruleName in nextRules)) {
      nextRules[ruleName] = "'off'"
    }
  }

  return nextRules
}
