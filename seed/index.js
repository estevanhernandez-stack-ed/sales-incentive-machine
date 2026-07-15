const Database = require("better-sqlite3");
const fs = require("node:fs");
const path = require("node:path");

const dataDir = path.join(process.cwd(), "data");
const dbPath = path.join(dataDir, "sim.db");
const schemaPath = path.join(process.cwd(), "lib", "db", "schema.sql");
const fallbackPath = path.join(process.cwd(), "seed", "fallback-contest.json");

function rng(seed = 20260713) {
  let state = seed >>> 0;
  return () => ((state = (state * 1664525 + 1013904223) >>> 0) / 4294967296);
}

function pick(random, values) { return values[Math.floor(random() * values.length)]; }
function shuffle(random, values) {
  const copy = [...values];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

const menu = [
  ["Ember Corn Cups", "app", 8, 0], ["Citrus Bean Dip", "app", 9, 0], ["Crisp Plantain Stack", "app", 10, 0], ["Charred Pepper Bites", "app", 11, 0], ["Golden Winglets", "app", 12, 0], ["Garden Skewers", "app", 9, 0], ["Smoky Queso Bowl", "app", 10, 0], ["Hearth Flatbread", "app", 11, 0],
  ["Hearth Burger", "entree", 16, 0], ["River Grain Bowl", "entree", 15, 0], ["Saffron Chicken", "entree", 19, 0], ["Cedar Salmon", "entree", 22, 0], ["Roasted Pepper Pasta", "entree", 17, 0], ["Market Steak Plate", "entree", 28, 0], ["Crisp Tofu Wrap", "entree", 14, 0], ["Lemon Herb Plate", "entree", 18, 0],
  ["Honey Cloud Cake", "dessert", 8, 0], ["Cocoa Pot", "dessert", 9, 0], ["Citrus Ice", "dessert", 7, 0], ["Salted Maple Tart", "dessert", 9, 0], ["Berry Crumble", "dessert", 8, 0], ["Warm Orchard Crisp", "dessert", 8, 0],
  ["Sunset Fizz", "cocktail", 11, 1], ["Garden Spark", "cocktail", 12, 1], ["Copper Mule", "cocktail", 13, 1], ["Hearth Old Fashioned", "cocktail", 14, 1], ["Juniper Cooler", "cocktail", 12, 1], ["Lime Lantern", "cocktail", 11, 1],
  ["Reserve Agave Pour", "top_shelf", 18, 1], ["North Star Rye", "top_shelf", 19, 1], ["Velvet Citrus Martini", "top_shelf", 20, 1], ["Oakline Pour", "top_shelf", 21, 1], ["Moonlit Spritz", "top_shelf", 18, 1],
  ["Hibiscus Soda", "na_bev", 5, 0], ["Cucumber Cooler", "na_bev", 5, 0], ["Sparkling Citrus", "na_bev", 4, 0], ["Ginger Orchard Tea", "na_bev", 4, 0], ["Cold Brew Tonic", "na_bev", 6, 0], ["Cloudy Lemonade", "na_bev", 4, 0], ["Minted Mineral", "na_bev", 4, 0]
];

const servers = [
  ["Avery Moss", "#d97706"], ["Blair Rowan", "#be123c"], ["Cameron Vale", "#0f766e"], ["Devon Sky", "#2563eb"], ["Ellis Reed", "#7c3aed"], ["Finley Hart", "#b45309"],
  ["Gray Lane", "#047857"], ["Harper Quinn", "#c026d3"], ["Indigo Park", "#0891b2"], ["Jordan Wren", "#4f46e5"], ["Kai Sol", "#ca8a04"], ["Logan Briar", "#dc2626"]
];

function partySize(random) { return pick(random, [1, 2, 2, 2, 3, 3, 4, 4, 5, 6, 7, 8, 10]); }

fs.mkdirSync(dataDir, { recursive: true });
fs.rmSync(dbPath, { force: true });
const db = new Database(dbPath);
db.exec(fs.readFileSync(schemaPath, "utf8"));
const random = rng();
const insertServer = db.prepare("INSERT INTO servers (id, name, color, active) VALUES (?, ?, ?, 1)");
const insertMenu = db.prepare("INSERT INTO menu_items (id, name, category, price, is_alcohol) VALUES (?, ?, ?, ?, ?)");
const insertCheck = db.prepare("INSERT INTO checks (id, server_id, opened_at, party_size, subtotal) VALUES (?, ?, ?, ?, ?)");
const insertItem = db.prepare("INSERT INTO check_items (id, check_id, menu_item_id, qty, price_each) VALUES (?, ?, ?, ?, ?)");

servers.forEach(([name, color], index) => insertServer.run(index + 1, name, color));
menu.forEach(([name, category, price, isAlcohol], index) => insertMenu.run(index + 1, name, category, price, isAlcohol));

let checkId = 1;
let itemId = 1;
const insertSales = db.transaction(() => {
  for (let week = 0; week < 4; week += 1) {
    for (let serverId = 1; serverId <= servers.length; serverId += 1) {
      const shifts = 4 + (random() > 0.55 ? 1 : 0);
      for (let shift = 0; shift < shifts; shift += 1) {
        const checks = 8 + Math.floor(random() * 8);
        for (let i = 0; i < checks; i += 1) {
          const party = partySize(random);
          const selected = [pick(random, menu.filter((item) => item[1] === "entree"))];
          if (random() < 0.32 + (serverId === 1 ? 0.24 : 0)) selected.push(pick(random, menu.filter((item) => item[1] === "cocktail" || item[1] === "top_shelf")));
          if (random() < 0.34) selected.push(pick(random, menu.filter((item) => item[1] === "app")));
          if (random() < 0.22 + (serverId === 5 ? 0.2 : serverId === 2 ? -0.16 : 0)) selected.push(pick(random, menu.filter((item) => item[1] === "dessert")));
          if (random() < 0.28) selected.push(pick(random, menu.filter((item) => item[1] === "na_bev")));
          const items = selected.map((item) => ({ item, qty: party >= 6 && random() < 0.4 ? 2 : 1 }));
          const subtotal = items.reduce((total, { item, qty }) => total + item[2] * qty, 0);
          const openedAt = new Date(Date.UTC(2026, 5, 15 + week * 7 + shift, 17 + (i % 5), 0, 0)).toISOString();
          insertCheck.run(checkId, serverId, openedAt, party, subtotal);
          items.forEach(({ item, qty }) => { insertItem.run(itemId++, checkId, menu.indexOf(item) + 1, qty, item[2]); });
          checkId += 1;
        }
      }
    }
  }
});
insertSales();

const fallback = fs.readFileSync(fallbackPath, "utf8");
db.prepare("INSERT INTO contests (id, name, week_start, config_json, status, created_via) VALUES (1, ?, ?, ?, 'active', 'manual')").run("Summer Signal Sprint", "2026-07-13", fallback);
db.prepare("INSERT INTO contests (id, name, week_start, config_json, status, created_via) VALUES (2, ?, ?, ?, 'closed', 'manual')").run("Harbor Hour Push", "2026-07-06", fallback);

const insertCard = db.prepare("INSERT INTO bingo_cards (id, contest_id, server_id, grid_json, created_at) VALUES (?, 1, ?, ?, ?)");
for (let serverId = 1; serverId <= servers.length; serverId += 1) {
  const cells = shuffle(random, Array.from({ length: 28 }, (_, index) => index + 1)).slice(0, 24);
  cells.splice(12, 0, "FREE");
  insertCard.run(serverId, serverId, JSON.stringify(cells), "2026-07-13T16:00:00.000Z");
}
const insertSubmission = db.prepare("INSERT INTO bingo_submissions (card_id, submitted_at, marked_cells_json, lines_completed, entries_awarded) VALUES (?, ?, ?, ?, ?)");
insertSubmission.run(1, "2026-07-13T20:00:00.000Z", JSON.stringify([0, 1, 2, 3, 4, 12]), 1, 1);
insertSubmission.run(4, "2026-07-13T20:10:00.000Z", JSON.stringify([0, 5, 10, 12, 15, 20]), 1, 1);
insertSubmission.run(7, "2026-07-13T20:20:00.000Z", JSON.stringify([1, 6, 11, 12, 16, 21]), 0, 0);
db.prepare("INSERT INTO wheel_drawings (contest_id, drawn_at, winner_server_id, entries_snapshot_json) VALUES (2, ?, 3, ?)").run("2026-07-11T03:00:00.000Z", JSON.stringify([{ serverId: 3, entries: 3 }, { serverId: 1, entries: 2 }]));

db.close();
console.log(`SIM seed complete: ${servers.length} servers, ${menu.length} menu items, ${checkId - 1} checks.`);
