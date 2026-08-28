"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/supabase/types";

type UserContextValue = {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
};

const UserContext = createContext<UserContextValue>({
  user: null,
  profile: null,
  loading: true,
});

// initialUser viene resuelto desde el Server Component raíz (layout) para
// que no haya "parpadeo" sin usuario en el primer render. A partir de ahí,
// se suscribe a onAuthStateChange para mantenerse al día tras login/logout.
export function UserProvider({
  initialUser,
  children,
}: {
  initialUser: User | null;
  children: ReactNode;
}) {
  const [user, setUser] = useState<User | null>(initialUser);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async (currentUser: User | null) => {
    if (!currentUser) {
      setProfile(null);
      return;
    }

    const supabase = createClient();
    const { data } = await supabase
      .from("profiles")
      .select("id, display_name, player_code, avatar_url, created_at")
      .eq("id", currentUser.id)
      .single();

    setProfile((data as Profile | null) ?? null);
  }, []);

  useEffect(() => {
    const supabase = createClient();

    loadProfile(initialUser).finally(() => setLoading(false));

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      void loadProfile(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
    // Solo se registra una vez: initialUser es el valor inicial del server,
    // los cambios posteriores llegan por onAuthStateChange.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <UserContext.Provider value={{ user, profile, loading }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  return useContext(UserContext);
}
