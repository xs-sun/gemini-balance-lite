import { handleVerification } from './verify_keys.js';
import openai from './openai.mjs';

export async function handleRequest(request, env) {
  const googleApiKeys = env.apiKeys ? env.apiKeys.join(',') : []
  const authToken = env.authToken
  const url = new URL(request.url);
  const pathname = url.pathname;
  const search = url.search;

  if (pathname === '/' || pathname === '/index.html') {
    return new Response('Proxy is Running!', {
      status: 200,
      headers: { 'Content-Type': 'text/html' }
    });
  }

  if (pathname === '/verify' && request.method === 'POST') {
    return handleVerification(request);
  }
  let apiKey = ''
  if (googleApiKeys.length > 0) {
    apiKey = googleApiKeys[Math.floor(Math.random() * googleApiKeys.length)];
    console.log(`Gemini Selected API Key: ${apiKey}`);
  } else {
    return new Response(JSON.stringify({ error: 'auth error. no keys' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // 处理OpenAI格式请求
  if (url.pathname.endsWith("/chat/completions") || url.pathname.endsWith("/completions") || url.pathname.endsWith("/embeddings") || url.pathname.endsWith("/models")) {
    return openai.fetch(request, apiKey);
  }

  const targetUrl = `https://gateway.ai.cloudflare.com/v1/${env.gwId}/gemini-gw/google-ai-studio${pathname}${search}`;

  try {
    const authHeader = request.headers.get('x-goog-api-key');
    if (!authHeader || authHeader !== env.authToken) {
      return new Response(JSON.stringify({ error: 'auth error.' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    const headers = new Headers();
    headers.set('x-goog-api-key', apiKey);
    for (const [key, value] of request.headers.entries()) {
      if (key.trim().toLowerCase()==='content-type') {
        headers.set(key, value);
      }
    }

    console.log('Request Sending to Gemini')
    console.log('targetUrl:'+targetUrl)
    console.log(headers)

    const response = await fetch(targetUrl, {
      method: request.method,
      headers: headers,
      body: request.body
    });

    console.log("Call Gemini Success")

    const responseHeaders = new Headers(response.headers);

    console.log('Header from Gemini:')
    console.log(responseHeaders)

    responseHeaders.delete('transfer-encoding');
    responseHeaders.delete('connection');
    responseHeaders.delete('keep-alive');
    responseHeaders.delete('content-encoding');
    responseHeaders.set('Referrer-Policy', 'no-referrer');

    return new Response(response.body, {
      status: response.status,
      headers: responseHeaders
    });

  } catch (error) {
   console.error('Failed to fetch:', error);
   return new Response('Internal Server Error\n' + error?.stack, {
    status: 500,
    headers: { 'Content-Type': 'text/plain' }
   });
}
};
