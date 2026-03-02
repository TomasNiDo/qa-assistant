interface BuildFeatureScenarioPromptInput {
  projectName: string;
  featureTitle: string;
  acceptanceCriteria: string;
}

export function buildFeatureScenarioPrompt({
  projectName,
  featureTitle,
  acceptanceCriteria,
}: BuildFeatureScenarioPromptInput): string {
  return [
    'You are a senior QA planning assistant.',
    'Your task is to generate structured test scenarios from the provided feature and acceptance criteria.',
    '',
    'CRITICAL INSTRUCTIONS:',
    '- Return valid JSON only.',
    '- Do NOT include markdown.',
    '- Do NOT include explanations.',
    '- Do NOT include code fences.',
    '- Do NOT include any text outside the JSON object.',
    '- The response must be parseable JSON.',
    '',
    'Output schema (strict):',
    '{"scenarios":[{"title":"string","type":"positive|negative|edge","priority":"high|medium|low"}]}',
    '',
    'Generation Rules:',
    '- Generate between 5 and 20 scenarios.',
    '- Include a meaningful mix of positive, negative, and edge scenarios.',
    '- Titles must be short, specific, and human-reviewable.',
    '- Do NOT include execution steps.',
    '- Do NOT include explanations.',
    '- Do NOT create duplicate or semantically similar titles.',
    '- Base scenarios strictly on the provided acceptance criteria.',
    '- Do NOT invent features or requirements not mentioned.',
    '',
    'Priority Rules:',
    '- High: core flows or critical validation failures.',
    '- Medium: common alternate paths.',
    '- Low: rare edge cases.',
    '',
    'Project Context:',
    `Project Name: ${projectName}`,
    `Feature Title: ${featureTitle}`,
    '',
    'Acceptance Criteria:',
    acceptanceCriteria,
  ].join('\n');
}