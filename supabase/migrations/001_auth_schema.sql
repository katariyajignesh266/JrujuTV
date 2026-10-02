CREATE EXTENSION IF NOT EXISTS citext;

CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.children (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    parent_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    username CITEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS children_parent_id_idx ON public.children(parent_id);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_children_updated_at
BEFORE UPDATE ON public.children
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.children ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "children_select_own_parent" ON public.children FOR SELECT USING (auth.uid() = parent_id);
CREATE POLICY "children_select_own_child" ON public.children FOR SELECT USING (auth.uid() = id);
CREATE POLICY "children_insert_parent" ON public.children FOR INSERT WITH CHECK (auth.uid() = parent_id);
CREATE POLICY "children_update_parent" ON public.children FOR UPDATE USING (auth.uid() = parent_id);
CREATE POLICY "children_delete_parent" ON public.children FOR DELETE USING (auth.uid() = parent_id);

CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    claims jsonb;
    app_metadata jsonb;
    user_role text;
    is_parent boolean;
BEGIN
    claims := event->'claims';
    app_metadata := claims->'app_metadata';
    
    IF app_metadata->>'role' = 'child' THEN
        claims := jsonb_set(claims, '{role}', '"child"');
        IF app_metadata->>'parent_id' IS NOT NULL THEN
            claims := jsonb_set(claims, '{parent_id}', (app_metadata->'parent_id'));
        END IF;
    ELSE
        SELECT EXISTS(SELECT 1 FROM public.profiles WHERE id = (event->>'user_id')::uuid) INTO is_parent;
        IF is_parent THEN
            claims := jsonb_set(claims, '{role}', '"parent"');
        ELSE
            claims := jsonb_set(claims, '{role}', '"guest"');
        END IF;
    END IF;
    
    event := jsonb_set(event, '{claims}', claims);
    RETURN event;
END;
$$;

GRANT EXECUTE ON FUNCTION public.custom_access_token_hook TO supabase_auth_admin;
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook FROM authenticated, anon, public;
