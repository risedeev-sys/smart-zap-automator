export const PUBLIC_CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
};

export function handleCors(req: Request): Response | { headers: Record<string, string> } {
    const origin = req.headers.get('origin') ?? '*';

    const corsHeaders = {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Headers': PUBLIC_CORS_HEADERS['Access-Control-Allow-Headers'],
        'Access-Control-Allow-Methods': PUBLIC_CORS_HEADERS['Access-Control-Allow-Methods'],
        'Access-Control-Allow-Credentials': 'true',
    };

    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
    return { headers: corsHeaders };
}
