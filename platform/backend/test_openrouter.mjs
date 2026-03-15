const OPENROUTER_KEY = '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';

async function testModel(model) {
  console.log(`\n=== Testing model: ${model} ===`);
  const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + OPENROUTER_KEY,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: 'Say hello in one short sentence.' }],
      max_tokens: 50,
      stream: true,
    })
  });

  console.log('HTTP status:', r.status);
  if (!r.ok) {
    const t = await r.text();
    console.log('Error:', t.slice(0, 400));
    return;
  }

  let content = '';
  const reader = r.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop() || '';
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const d = line.slice(6).trim();
      if (d === '[DONE]') continue;
      try {
        const p = JSON.parse(d);
        const delta = p.choices?.[0]?.delta?.content || '';
        content += delta;
      } catch {}
    }
  }
  console.log('Response:', content);
}

await testModel('google/gemini-2.5-pro');
await testModel('google/gemini-2.5-flash');
