import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../../auth/AuthContext";

// PR B1.5 — card data hook. All 6 endpoints from PR B1 are consumed here.

export type ScopeCard = {
  id: string;
  tenderId: string;
  name: string;
  discipline: string;
  cardNumber: number;
  sortOrder: number;
  itemCount: number;
  createdAt: string;
  updatedAt: string;
};

export type ChangeDisciplineResult = {
  card: ScopeCard;
  itemsRenumbered: number;
  cuttingRefsUpdated: number;
  wasteRefsUpdated: number;
};

export function useScopeCards(tenderId: string) {
  const { authFetch } = useAuth();
  const [cards, setCards] = useState<ScopeCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch(`/tenders/${tenderId}/scope/cards`);
      if (!res.ok) throw new Error(await res.text());
      setCards((await res.json()) as ScopeCard[]);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [authFetch, tenderId]);

  useEffect(() => {
    void load();
  }, [load]);

  const createCard = useCallback(
    async (name: string, discipline: string): Promise<ScopeCard> => {
      const res = await authFetch(`/tenders/${tenderId}/scope/cards`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, discipline })
      });
      if (!res.ok) throw new Error(await res.text());
      const created = (await res.json()) as ScopeCard;
      await load();
      return created;
    },
    [authFetch, tenderId, load]
  );

  const renameCard = useCallback(
    async (cardId: string, name: string): Promise<void> => {
      const res = await authFetch(`/tenders/${tenderId}/scope/cards/${cardId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name })
      });
      if (!res.ok) throw new Error(await res.text());
      await load();
    },
    [authFetch, tenderId, load]
  );

  const changeDiscipline = useCallback(
    async (cardId: string, discipline: string): Promise<ChangeDisciplineResult> => {
      const res = await authFetch(`/tenders/${tenderId}/scope/cards/${cardId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ discipline })
      });
      if (!res.ok) throw new Error(await res.text());
      const result = (await res.json()) as ChangeDisciplineResult;
      await load();
      return result;
    },
    [authFetch, tenderId, load]
  );

  const deleteCard = useCallback(
    async (cardId: string): Promise<void> => {
      const res = await authFetch(`/tenders/${tenderId}/scope/cards/${cardId}`, {
        method: "DELETE"
      });
      if (!res.ok) {
        if (res.status === 409) {
          // Server returns { message, statusCode } when ConflictException fires.
          try {
            const body = (await res.json()) as { message?: string };
            throw new Error(body.message ?? "Card has items — cannot delete.");
          } catch {
            throw new Error("Card has items — cannot delete.");
          }
        }
        throw new Error(await res.text());
      }
      await load();
    },
    [authFetch, tenderId, load]
  );

  const reorderCards = useCallback(
    async (cardIds: string[]): Promise<void> => {
      // Optimistic reorder; rollback (via reload) if the POST fails.
      setCards((prev) => {
        const byId = new Map(prev.map((c) => [c.id, c]));
        return cardIds
          .map((id, index) => {
            const card = byId.get(id);
            return card ? { ...card, sortOrder: index } : null;
          })
          .filter((c): c is ScopeCard => c !== null);
      });
      const res = await authFetch(`/tenders/${tenderId}/scope/cards/reorder`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardIds })
      });
      if (!res.ok) {
        await load();
        throw new Error(await res.text());
      }
    },
    [authFetch, tenderId, load]
  );

  return {
    cards,
    loading,
    error,
    reload: load,
    createCard,
    renameCard,
    changeDiscipline,
    deleteCard,
    reorderCards
  };
}
