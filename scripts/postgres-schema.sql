CREATE TABLE IF NOT EXISTS forehead_v3_rooms (
  id uuid PRIMARY KEY,
  code text NOT NULL UNIQUE CHECK (code ~ '^[0-9]{6}$'),
  revision bigint NOT NULL DEFAULT 0 CHECK (revision >= 0),
  version bigint NOT NULL DEFAULT 0 CHECK (version >= 0),
  state jsonb NOT NULL,
  creator_id uuid NOT NULL,
  expires_at bigint NOT NULL
);
ALTER TABLE forehead_v3_rooms ADD COLUMN IF NOT EXISTS version bigint NOT NULL DEFAULT 0 CHECK (version >= 0);
CREATE INDEX IF NOT EXISTS forehead_v3_rooms_expiry ON forehead_v3_rooms(expires_at);

CREATE TABLE IF NOT EXISTS forehead_v3_presence (
  room_id uuid NOT NULL REFERENCES forehead_v3_rooms(id) ON DELETE CASCADE,
  player_id uuid NOT NULL,
  last_seen bigint NOT NULL,
  PRIMARY KEY (room_id,player_id)
);

CREATE TABLE IF NOT EXISTS forehead_v3_photos (
  path text PRIMARY KEY,
  room_id uuid NOT NULL REFERENCES forehead_v3_rooms(id) ON DELETE CASCADE,
  bytes bytea NOT NULL,
  mime text NOT NULL CHECK (mime IN ('image/jpeg','image/png','image/webp')),
  created_at bigint NOT NULL
);
CREATE INDEX IF NOT EXISTS forehead_v3_photos_room ON forehead_v3_photos(room_id);
CREATE INDEX IF NOT EXISTS forehead_v3_photos_age ON forehead_v3_photos(created_at);

CREATE TABLE IF NOT EXISTS forehead_v3_limits (
  key text NOT NULL,
  window_start bigint NOT NULL,
  count integer NOT NULL CHECK (count >= 0),
  requests text[] NOT NULL DEFAULT '{}',
  expires_at bigint NOT NULL,
  PRIMARY KEY (key,window_start)
);
CREATE INDEX IF NOT EXISTS forehead_v3_limits_expiry ON forehead_v3_limits(expires_at);
