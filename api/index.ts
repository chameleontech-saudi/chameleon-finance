import type { IncomingMessage, ServerResponse } from 'node:http';

type JsonResponse = {
  error: string;
  details?: string;
};

const sendJson = (res: ServerResponse, status: number, payload: JsonResponse) => {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
};

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    const { default: app } = await import('../server/index.js');
    return app(req, res);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown server error';
    const payload: JsonResponse = {
      error: 'API function failed to load.'
    };

    if (process.env.NODE_ENV !== 'production') {
      payload.details = message;
    }

    console.error('API function load error:', error);
    return sendJson(res, 500, payload);
  }
}
