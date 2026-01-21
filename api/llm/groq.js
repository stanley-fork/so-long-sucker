export async function POST(request) {
  const { systemPrompt, userPrompt, tools, model } = await request.json();

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: 'GROQ_API_KEY not configured on server' },
      { status: 500 }
    );
  }

  console.log(`🤖 Groq [proxy] ${model || 'llama-3.3-70b-versatile'}`);

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: model || 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      tools,
      tool_choice: 'auto',
      temperature: 0.7
    })
  });

  const data = await response.json();

  if (!response.ok) {
    console.error('❌ Groq API error:', data.error?.message || response.statusText);
    return Response.json(
      { error: data.error?.message || 'Groq API error' },
      { status: response.status }
    );
  }

  return Response.json(data);
}
