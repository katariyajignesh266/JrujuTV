CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    claims jsonb;
    app_metadata jsonb;
    is_parent boolean;
BEGIN
    claims := event->'claims';
    app_metadata := claims->'app_metadata';
    
    -- Ensure Postgres role remains 'authenticated' for PostgREST
    claims := jsonb_set(claims, '{role}', '"authenticated"');
    
    -- Store custom application role in user_role
    IF app_metadata->>'role' = 'child' THEN
        claims := jsonb_set(claims, '{user_role}', '"child"');
        IF app_metadata->>'parent_id' IS NOT NULL THEN
            claims := jsonb_set(claims, '{parent_id}', (app_metadata->'parent_id'));
        END IF;
    ELSE
        SELECT EXISTS(SELECT 1 FROM public.profiles WHERE id = (event->>'user_id')::uuid) INTO is_parent;
        IF is_parent THEN
            claims := jsonb_set(claims, '{user_role}', '"parent"');
        ELSE
            claims := jsonb_set(claims, '{user_role}', '"guest"');
        END IF;
    END IF;
    
    event := jsonb_set(event, '{claims}', claims);
    RETURN event;
END;
$$;

GRANT EXECUTE ON FUNCTION public.custom_access_token_hook TO supabase_auth_admin;
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook FROM authenticated, anon, public;
