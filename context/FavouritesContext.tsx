"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { createClient, hasSupabaseConfig } from "@/lib/supabase/client";
import { useAuth } from "@/context/AuthContext";

interface Favourite {
  type: string;
  external_id: number;
  name: string | null;
  logo_url: string | null;
}

interface FavouritesCtx {
  favourites: Favourite[];
  isFavourite: (type: string, id: number) => boolean;
  toggleFavourite: (type: string, id: number, name: string) => Promise<void>;
}

const FavouritesContext = createContext<FavouritesCtx>({
  favourites: [],
  isFavourite: () => false,
  toggleFavourite: async () => {},
});

export function FavouritesProvider({ children }: { children: React.ReactNode }) {
  const { user, openAuthModal } = useAuth();
  const [favourites, setFavourites] = useState<Favourite[]>([]);

  // Load favourites when user logs in
  useEffect(() => {
    if (!user || !hasSupabaseConfig()) {
      setFavourites([]);
      return;
    }
    const supabase = createClient();
    supabase
      .from("favourites")
      .select("type, external_id, name, logo_url")
      .eq("user_id", user.id)
      .then(({ data }) => {
        if (data) setFavourites(data);
      });
  }, [user]);

  const isFavourite = useCallback(
    (type: string, id: number) =>
      favourites.some((f) => f.type === type && f.external_id === id),
    [favourites]
  );

  const toggleFavourite = useCallback(
    async (type: string, id: number, name: string) => {
      if (!user) {
        openAuthModal("login");
        return;
      }
      if (!hasSupabaseConfig()) return;

      const supabase = createClient();
      const exists = favourites.some((f) => f.type === type && f.external_id === id);

      if (exists) {
        await supabase
          .from("favourites")
          .delete()
          .eq("user_id", user.id)
          .eq("type", type)
          .eq("external_id", id);
        setFavourites((prev) => prev.filter((f) => !(f.type === type && f.external_id === id)));
      } else {
        const newFav: Favourite = { type, external_id: id, name, logo_url: null };
        await supabase
          .from("favourites")
          .insert({ user_id: user.id, type, external_id: id, name });
        setFavourites((prev) => [...prev, newFav]);
      }
    },
    [user, favourites, openAuthModal]
  );

  return (
    <FavouritesContext.Provider value={{ favourites, isFavourite, toggleFavourite }}>
      {children}
    </FavouritesContext.Provider>
  );
}

export function useFavourites() {
  return useContext(FavouritesContext);
}
