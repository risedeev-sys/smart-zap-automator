import { createClient } from 'jsr:@supabase/supabase-js@2'

export function getSupabaseClient(req: Request) {
    const authHeader = req.headers.get('Authorization')

    if (!authHeader) {
        throw new Error('Missing Authorization header')
    }

    // Create a Supabase client with the Auth context of the logged-in user.
    // This allows Row Level Security to work as expected.
    return createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? '',
        {
            global: {
                headers: { Authorization: authHeader },
            },
        }
    )
}
