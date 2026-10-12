// Only pending card text is persisted. Session tokens, photos, proofs and URLs
// never enter this cache. The server remains authoritative for the game.
const clean = text => String(text ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim();
export class TextDrafts {
  constructor(storage, makeId = () => globalThis.crypto.randomUUID().replaceAll('-', '')) {
    this.storage = storage; this.makeId = makeId; this.entries = new Map();
    this.key = null; this.scope = null; this.sequence = 0; this.loaded = false;
    this.active = false; this.persisted = true;
  }
  bind(snapshot, { protectedCards = new Set() } = {}) {
    const scope = { roomId: snapshot.id, playerId: snapshot.you, generation: snapshot.generation };
    const key = `forehead-text-v1-${scope.roomId}-${scope.playerId}-${scope.generation}`;
    const actor = snapshot.players.find(player => player.id === snapshot.you);
    const eligible = snapshot.phase === 'writing' && !actor?.ready;
    if (key !== this.key) {
      if (this.scope?.roomId === scope.roomId && this.scope?.playerId === scope.playerId && this.scope.generation !== scope.generation) {
        try { this.storage?.removeItem(this.key); } catch {}
      }
      this.scope = scope; this.key = key; this.entries.clear(); this.loaded = false;
    }
    this.active = eligible;
    const cards = snapshot.ownCards ?? [], allowed = new Set(cards.map(card => card.id));
    if (eligible && !this.loaded) {
      let saved;
      try { saved = JSON.parse(this.storage?.getItem(key) ?? 'null'); } catch {}
      if (saved && typeof saved === 'object' && !Array.isArray(saved)) {
        for (const [cardId, text] of Object.entries(saved)) {
          if (allowed.has(cardId) && typeof text === 'string' && text.length <= 160) {
            this.entries.set(cardId, { text, sequence: ++this.sequence });
          }
        }
      }
      this.loaded = true;
    }
    if (snapshot.phase === 'writing' && this.loaded) {
      for (const [cardId, entry] of this.entries) {
        const card = cards.find(value => value.id === cardId);
        if (!card || (!protectedCards.has(cardId) && clean(entry.text) === card.text)) this.entries.delete(cardId);
      }
      this.persist();
    }
    return this.values();
  }
  values() { return new Map(this.active ? [...this.entries].map(([id, entry]) => [id, entry.text]) : []); }
  pending() { return this.active ? [...this.entries.keys()] : []; }
  has(cardId) { return this.active && this.entries.has(cardId); }
  set(cardId, text) {
    if (!this.active) return;
    if (this.entries.get(cardId)?.text !== text) this.entries.set(cardId, { text, sequence: ++this.sequence });
    this.persist();
  }
  ticket(cardId) {
    const entry = this.active && this.entries.get(cardId);
    if (!entry) return null;
    entry.requestId ??= this.makeId();
    return { ...this.scope, key: this.key, cardId, ...entry };
  }
  acknowledge(ticket) {
    if (ticket?.key !== this.key || this.entries.get(ticket.cardId)?.sequence !== ticket.sequence) return false;
    this.entries.delete(ticket.cardId); this.persist(); return true;
  }
  persist() {
    if (!this.key) return true;
    try {
      if (this.entries.size) this.storage?.setItem(this.key, JSON.stringify(Object.fromEntries([...this.entries].map(([id, entry]) => [id, entry.text]))));
      else this.storage?.removeItem(this.key);
      this.persisted = Boolean(this.storage); return this.persisted;
    } catch { this.persisted = false; return false; }
  }
  suspend() { this.persist(); this.active = false; }
}
