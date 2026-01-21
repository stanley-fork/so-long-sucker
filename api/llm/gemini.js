function convertSchema(schema) {
  if (!schema || typeof schema !== 'object') return schema;
  const result = {};

  if (schema.type) {
    if (Array.isArray(schema.type)) {
      result.type = 'STRING';
    } else {
      const typeMap = {
        'string': 'STRING',
        'integer': 'INTEGER',
        'number': 'NUMBER',
        'boolean': 'BOOLEAN',
        'array': 'ARRAY',
        'object': 'OBJECT'
      };
      result.type = typeMap[schema.type] || 'STRING';
    }
  }

  if (schema.description) result.description = schema.description;
  if (schema.enum) result.enum = schema.enum;
  if (schema.properties) {
    result.properties = {};
    for (const [key, value] of Object.entries(schema.properties)) {
      result.properties[key] = convertSchema(value);
    }
  }
  if (schema.required) result.required = schema.required;
  if (schema.items) result.items = convertSchema(schema.items);

  return result;
}

function formatTools(tools) {
  if (!tools || tools.length === 0) return undefined;
  return [{
    functionDeclarations: tools.map(t => ({
      name: t.name,
      description: t.description,
      parameters: convertSchema(t.parameters)
    }))
  }];
}

export async function POST(request) {
  const { systemPrompt, userPrompt, tools, model } = await request.json();

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: 'GEMINI_API_KEY not configured on server' },
      { status: 500 }
    );
  }

  const modelName = model || 'gemini-2.5-flash';
  console.log(`🤖 Gemini [proxy] ${modelName}`);

  const body = {
    systemInstruction: { parts: [{ text: systemPrompt }] },
    contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
    generationConfig: { temperature: 0.7 }
  };

  const formattedTools = formatTools(tools);
  if (formattedTools) {
    body.tools = formattedTools;
    body.toolConfig = { functionCallingConfig: { mode: 'AUTO' } };
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey
      },
      body: JSON.stringify(body)
    }
  );

  const data = await response.json();

  if (!response.ok) {
    console.error('❌ Gemini API error:', data.error?.message || response.statusText);
    return Response.json(
      { error: data.error?.message || 'Gemini API error' },
      { status: response.status }
    );
  }

  return Response.json(data);
}
