// Simple in-memory rate limiter (800 requests/hour per IP)
const rateLimitMap = new Map();
const RATE_LIMIT = 800;
const RATE_WINDOW = 60 * 60 * 1000; // 1 hour

function getIP(request) {
  const forwarded = request.headers.get('x-forwarded-for');
  return forwarded ? forwarded.split(',')[0].trim() : 'unknown';
}

function checkRateLimit(ip) {
  const now = Date.now();
  const record = rateLimitMap.get(ip);
  
  if (!record || now - record.start > RATE_WINDOW) {
    rateLimitMap.set(ip, { start: now, count: 1 });
    return { allowed: true, remaining: RATE_LIMIT - 1 };
  }
  
  if (record.count >= RATE_LIMIT) {
    return { allowed: false, remaining: 0 };
  }
  
  record.count++;
  return { allowed: true, remaining: RATE_LIMIT - record.count };
}

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
  const ip = getIP(request);
  const rateLimit = checkRateLimit(ip);
  
  if (!rateLimit.allowed) {
    console.log(`🚫 Gemini rate limit exceeded for IP: ${ip}`);
    return Response.json(
      { error: 'Rate limit exceeded', fallbackToGroq: true },
      { status: 429 }
    );
  }

  const { systemPrompt, userPrompt, tools, model } = await request.json();

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: 'GEMINI_API_KEY not configured on server' },
      { status: 500 }
    );
  }

  const modelName = model || 'gemini-3-flash-preview';
  console.log(`🤖 Gemini [proxy] ${modelName} (${rateLimit.remaining} remaining)`);

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
    
    if (response.status === 429) {
      return Response.json(
        { error: 'Rate limit exceeded', fallbackToGroq: true },
        { status: 429 }
      );
    }
    
    return Response.json(
      { error: data.error?.message || 'Gemini API error' },
      { status: response.status }
    );
  }

  return Response.json(data);
}
