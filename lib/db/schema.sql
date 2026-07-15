PRAGMA foreign_keys = ON;

CREATE TABLE servers (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  color TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE menu_items (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK(category IN ('app', 'entree', 'dessert', 'cocktail', 'top_shelf', 'na_bev')),
  price REAL NOT NULL,
  is_alcohol INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE checks (
  id INTEGER PRIMARY KEY,
  server_id INTEGER NOT NULL REFERENCES servers(id),
  opened_at TEXT NOT NULL,
  party_size INTEGER NOT NULL CHECK(party_size > 0),
  subtotal REAL NOT NULL CHECK(subtotal >= 0)
);

CREATE TABLE check_items (
  id INTEGER PRIMARY KEY,
  check_id INTEGER NOT NULL REFERENCES checks(id) ON DELETE CASCADE,
  menu_item_id INTEGER NOT NULL REFERENCES menu_items(id),
  qty INTEGER NOT NULL CHECK(qty > 0),
  price_each REAL NOT NULL CHECK(price_each >= 0)
);

CREATE TABLE data_imports (
  id INTEGER PRIMARY KEY,
  file_name TEXT NOT NULL,
  imported_at TEXT NOT NULL,
  row_count INTEGER NOT NULL CHECK(row_count >= 0),
  content_hash TEXT NOT NULL UNIQUE
);

CREATE TABLE sales_entry_audit (
  check_id INTEGER PRIMARY KEY REFERENCES checks(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL CHECK(source_type IN ('imported', 'manual', 'corrected')),
  note TEXT NOT NULL DEFAULT '',
  data_import_id INTEGER REFERENCES data_imports(id),
  is_itemized INTEGER NOT NULL DEFAULT 0 CHECK(is_itemized IN (0, 1))
);

CREATE TABLE sales_corrections (
  id INTEGER PRIMARY KEY,
  check_id INTEGER NOT NULL REFERENCES checks(id) ON DELETE CASCADE,
  corrected_at TEXT NOT NULL,
  note TEXT NOT NULL,
  before_json TEXT NOT NULL
);

CREATE TABLE synthetic_pos_receipts (
  id INTEGER PRIMARY KEY,
  external_reference TEXT NOT NULL UNIQUE,
  source_label TEXT NOT NULL,
  check_id INTEGER NOT NULL UNIQUE REFERENCES checks(id) ON DELETE CASCADE,
  received_at TEXT NOT NULL
);

CREATE TABLE contests (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  week_start TEXT NOT NULL,
  config_json TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('draft', 'active', 'closed')),
  created_via TEXT NOT NULL CHECK(created_via IN ('manual', 'ai'))
);

CREATE TABLE bingo_cards (
  id INTEGER PRIMARY KEY,
  contest_id INTEGER NOT NULL REFERENCES contests(id) ON DELETE CASCADE,
  server_id INTEGER NOT NULL REFERENCES servers(id),
  grid_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE bingo_submissions (
  id INTEGER PRIMARY KEY,
  card_id INTEGER NOT NULL REFERENCES bingo_cards(id) ON DELETE CASCADE,
  submitted_at TEXT NOT NULL,
  marked_cells_json TEXT NOT NULL,
  lines_completed INTEGER NOT NULL DEFAULT 0,
  entries_awarded INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE wheel_drawings (
  id INTEGER PRIMARY KEY,
  contest_id INTEGER NOT NULL REFERENCES contests(id) ON DELETE CASCADE,
  drawn_at TEXT NOT NULL,
  winner_server_id INTEGER NOT NULL REFERENCES servers(id),
  entries_snapshot_json TEXT NOT NULL,
  UNIQUE(contest_id)
);

CREATE TABLE game_awards (
  id INTEGER PRIMARY KEY,
  contest_id INTEGER NOT NULL REFERENCES contests(id) ON DELETE CASCADE,
  game_id TEXT NOT NULL,
  server_id INTEGER NOT NULL REFERENCES servers(id),
  award_type TEXT NOT NULL CHECK(award_type IN ('sales_race', 'menu_mission')),
  place INTEGER,
  entries_awarded INTEGER NOT NULL CHECK(entries_awarded >= 0),
  awarded_at TEXT NOT NULL,
  UNIQUE(contest_id, game_id, server_id),
  UNIQUE(contest_id, game_id, place)
);

CREATE INDEX checks_server_opened_at_idx ON checks(server_id, opened_at);
CREATE INDEX check_items_check_idx ON check_items(check_id);
CREATE INDEX sales_entry_audit_source_idx ON sales_entry_audit(source_type);
CREATE INDEX sales_corrections_check_idx ON sales_corrections(check_id);
CREATE INDEX synthetic_pos_receipts_received_idx ON synthetic_pos_receipts(received_at);
CREATE UNIQUE INDEX bingo_daily_winning_card_idx ON bingo_submissions(card_id, date(submitted_at)) WHERE lines_completed >= 1;
CREATE INDEX game_awards_contest_server_idx ON game_awards(contest_id, server_id);
CREATE INDEX bingo_cards_contest_server_idx ON bingo_cards(contest_id, server_id);
