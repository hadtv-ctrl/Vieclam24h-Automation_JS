const test = require('node:test');
const assert = require('node:assert/strict');
const { sendChatCompletion } = require('./openaiCompatible');

test('sendChatCompletion: sends stream: false in payload and parses standard JSON', async () => {
  let capturedBody = null;
  const mockFetch = async (url, options) => {
    capturedBody = JSON.parse(options.body);
    return {
      status: 200,
      ok: true,
      text: async () => JSON.stringify({
        id: 'chatcmpl-1',
        model: 'test-model',
        choices: [{ message: { role: 'assistant', content: 'Test response' } }],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 }
      })
    };
  };

  const res = await sendChatCompletion({
    baseURL: 'http://localhost:20128/v1',
    apiKey: 'test-key',
    model: 'test-model',
    messages: [{ role: 'user', content: 'hello' }],
    fetchImpl: mockFetch
  });

  assert.equal(res.ok, true);
  assert.equal(capturedBody.stream, false);
  assert.equal(res.text, 'Test response');
  assert.equal(res.usage.total, 15);
});

test('sendChatCompletion: successfully decodes SSE chunks when server returns event-stream', async () => {
  const sseBody = [
    'data: {"id":"chatcmpl-1","choices":[{"index":0,"delta":{"role":"assistant"},"finish_reason":null}]}',
    '',
    'data: {"id":"chatcmpl-1","choices":[{"index":0,"delta":{"content":"Hello "},"finish_reason":null}]}',
    '',
    'data: {"id":"chatcmpl-1","choices":[{"index":0,"delta":{"content":"World!"},"finish_reason":null}]}',
    '',
    'data: [DONE]'
  ].join('\n');

  const mockFetch = async () => ({
    status: 200,
    ok: true,
    text: async () => sseBody
  });

  const res = await sendChatCompletion({
    baseURL: 'http://localhost:20128/v1',
    apiKey: 'test-key',
    model: 'test-model',
    messages: [{ role: 'user', content: 'hello' }],
    fetchImpl: mockFetch
  });

  assert.equal(res.ok, true);
  assert.equal(res.text, 'Hello World!');
});
