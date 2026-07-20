-- Enable Row Level Security
ALTER DATABASE postgres SET "graphql.max_rows" = 1000;

-- Profiles Table (holds public user info, tied to auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
    username TEXT NOT NULL,
    display_name TEXT,
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Spaces Table
CREATE TABLE IF NOT EXISTS public.spaces (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    avatar_url TEXT,
    invite_code TEXT UNIQUE NOT NULL,
    owner_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    archived_at TIMESTAMP WITH TIME ZONE
);

-- Categories Table
CREATE TABLE IF NOT EXISTS public.categories (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    space_id UUID REFERENCES public.spaces ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    position INTEGER DEFAULT 0 NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Channels Table
CREATE TABLE IF NOT EXISTS public.channels (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    space_id UUID REFERENCES public.spaces ON DELETE CASCADE NOT NULL,
    category_id UUID REFERENCES public.categories ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT DEFAULT 'TEXT' NOT NULL CHECK (type IN ('TEXT', 'VOICE', 'STAGE')),
    position INTEGER DEFAULT 0 NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Members Table (junction table for Users and Spaces)
CREATE TABLE IF NOT EXISTS public.members (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    space_id UUID REFERENCES public.spaces ON DELETE CASCADE NOT NULL,
    profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    role TEXT DEFAULT 'MEMBER' NOT NULL CHECK (role IN ('OWNER', 'ADMIN', 'MEMBER')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    UNIQUE (space_id, profile_id)
);

-- Messages Table
CREATE TABLE IF NOT EXISTS public.messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    channel_id UUID REFERENCES public.channels ON DELETE CASCADE NOT NULL,
    profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- 1. Profiles Policies
CREATE POLICY "Allow public read access to profiles" ON public.profiles
    FOR SELECT USING (true);

CREATE POLICY "Allow users to update their own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Allow insert profile on user creation" ON public.profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

-- 2. Spaces Policies
CREATE POLICY "Allow space members to view their spaces" ON public.spaces
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.members
            WHERE members.space_id = spaces.id AND members.profile_id = auth.uid()
        ) AND archived_at IS NULL
    );

CREATE POLICY "Allow authenticated users to create spaces" ON public.spaces
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow space owner to update space" ON public.spaces
    FOR UPDATE USING (owner_id = auth.uid());

CREATE POLICY "Allow space owner to delete space" ON public.spaces
    FOR DELETE USING (owner_id = auth.uid());

-- 3. Members Policies
CREATE POLICY "Allow space members to view member list" ON public.members
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.members m
            WHERE m.space_id = members.space_id AND m.profile_id = auth.uid()
        )
    );

CREATE POLICY "Allow space members to join via invite code (insert)" ON public.members
    FOR INSERT WITH CHECK (auth.uid() = profile_id);

CREATE POLICY "Allow admins or self to remove members" ON public.members
    FOR DELETE USING (
        profile_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public.members m
            WHERE m.space_id = members.space_id AND m.profile_id = auth.uid() AND m.role IN ('ADMIN', 'OWNER')
        )
    );

-- 4. Categories Policies
CREATE POLICY "Allow members to view categories" ON public.categories
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.members
            WHERE members.space_id = categories.space_id AND members.profile_id = auth.uid()
        )
    );

CREATE POLICY "Allow space admins to manage categories" ON public.categories
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.members
            WHERE members.space_id = categories.space_id AND members.profile_id = auth.uid() AND members.role IN ('ADMIN', 'OWNER')
        )
    );

-- 5. Channels Policies
CREATE POLICY "Allow members to view channels" ON public.channels
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.members
            WHERE members.space_id = channels.space_id AND members.profile_id = auth.uid()
        )
    );

CREATE POLICY "Allow space admins to manage channels" ON public.channels
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.members
            WHERE members.space_id = channels.space_id AND members.profile_id = auth.uid() AND members.role IN ('ADMIN', 'OWNER')
        )
    );

-- 6. Messages Policies
CREATE POLICY "Allow space members to view messages in channels" ON public.messages
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.channels
            JOIN public.members ON members.space_id = channels.space_id
            WHERE channels.id = messages.channel_id AND members.profile_id = auth.uid()
        )
    );

CREATE POLICY "Allow space members to post messages" ON public.messages
    FOR INSERT WITH CHECK (
        auth.uid() = profile_id AND
        EXISTS (
            SELECT 1 FROM public.channels
            JOIN public.members ON members.space_id = channels.space_id
            WHERE channels.id = messages.channel_id AND members.profile_id = auth.uid()
        )
    );

-- Trigger to automatically create profile on sign-up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, username, display_name, avatar_url)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
        COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
        NEW.raw_user_meta_data->>'avatar_url'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Trigger to automatically handle new spaces (Default Membership & Categories/Channels)
CREATE OR REPLACE FUNCTION public.handle_new_space()
RETURNS TRIGGER AS $$
DECLARE
    new_category_id UUID;
BEGIN
    -- 1. Insert the space owner into the members table
    IF NEW.owner_id IS NOT NULL THEN
        INSERT INTO public.members (space_id, profile_id, role)
        VALUES (NEW.id, NEW.owner_id, 'OWNER');
    END IF;

    -- 2. Create default category '기본'
    INSERT INTO public.categories (space_id, name, position)
    VALUES (NEW.id, '기본', 0)
    RETURNING id INTO new_category_id;

    -- 3. Create default text channel '# 일반'
    INSERT INTO public.channels (space_id, category_id, name, type, position)
    VALUES (NEW.id, new_category_id, '일반', 'TEXT', 0);

    -- 4. Create default voice channel '🔊 로비'
    INSERT INTO public.channels (space_id, category_id, name, type, position)
    VALUES (NEW.id, new_category_id, '로비', 'VOICE', 1);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_space_created
    AFTER INSERT ON public.spaces
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_space();
