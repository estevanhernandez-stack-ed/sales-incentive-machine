import type Database from "better-sqlite3";

export type Metric = "ppa" | "avg_check" | "alcohol_pct" | "attach_rate" | "item_count" | "large_party_ppa";

export type MetricDefinition = {
  metric: Metric;
  category?: "app" | "entree" | "dessert" | "cocktail" | "top_shelf" | "na_bev";
  menuItemId?: number;
};

type ValueRow = { value: number | null };

function scalar(db: Database.Database, sql: string, params: unknown[]): number {
  return (db.prepare(sql).get(...params) as ValueRow).value ?? 0;
}

function serverClause(serverId?: number) {
  return serverId === undefined ? { sql: "", params: [] as unknown[] } : { sql: "WHERE c.server_id = ?", params: [serverId] };
}

function itemizedServerClause(serverId?: number) {
  const itemized = "NOT EXISTS (SELECT 1 FROM sales_entry_audit sea WHERE sea.check_id = c.id AND sea.is_itemized = 0)";
  return serverId === undefined ? { sql: `WHERE ${itemized}`, params: [] as unknown[] } : { sql: `WHERE ${itemized} AND c.server_id = ?`, params: [serverId] };
}

/** Computes a metric from source records; final metric values are never persisted. */
export function getMetric(db: Database.Database, definition: MetricDefinition, serverId?: number, contestId?: number): number {
  const scope = serverClause(serverId);

  switch (definition.metric) {
    case "ppa":
      return scalar(db, `SELECT COALESCE(SUM(c.subtotal) / NULLIF(SUM(c.party_size), 0), 0) AS value FROM checks c ${scope.sql}`, scope.params);
    case "avg_check":
      return scalar(db, `SELECT COALESCE(SUM(c.subtotal) / NULLIF(COUNT(c.id), 0), 0) AS value FROM checks c ${scope.sql}`, scope.params);
    case "alcohol_pct":
      {
        const itemizedScope = itemizedServerClause(serverId);
        return scalar(db, `WITH scoped_checks AS (SELECT c.* FROM checks c ${itemizedScope.sql}) SELECT COALESCE((SELECT SUM(ci.qty * ci.price_each) FROM check_items ci JOIN menu_items m ON m.id = ci.menu_item_id JOIN scoped_checks c ON c.id = ci.check_id WHERE m.is_alcohol = 1) / NULLIF((SELECT SUM(subtotal) FROM scoped_checks), 0), 0) AS value`, itemizedScope.params);
      }
    case "large_party_ppa": {
      const where = scope.sql ? "WHERE c.party_size >= 6 AND c.server_id = ?" : "WHERE c.party_size >= 6";
      return scalar(db, `SELECT COALESCE(SUM(c.subtotal) / NULLIF(SUM(c.party_size), 0), 0) AS value FROM checks c ${where}`, scope.params);
    }
    case "attach_rate": {
      if (definition.menuItemId === undefined && !definition.category) throw new Error("attach_rate requires a category or menuItemId");
      const filter = definition.menuItemId === undefined ? "m.category = ?" : "ci.menu_item_id = ?";
      const target = definition.menuItemId ?? definition.category;
      const itemizedScope = itemizedServerClause(serverId);
      return scalar(
        db,
        `SELECT COALESCE(COUNT(DISTINCT CASE WHEN EXISTS (SELECT 1 FROM check_items ci JOIN menu_items m ON m.id = ci.menu_item_id WHERE ci.check_id = c.id AND ${filter}) THEN c.id END) * 1.0 / NULLIF(COUNT(c.id), 0), 0) AS value FROM checks c ${itemizedScope.sql}`,
        [target, ...itemizedScope.params]
      );
    }
    case "item_count":
      if (definition.menuItemId === undefined) throw new Error("item_count requires menuItemId");
      {
        const checkUnits = scalar(db, `SELECT COALESCE(SUM(ci.qty), 0) AS value FROM check_items ci JOIN checks c ON c.id = ci.check_id ${scope.sql} ${scope.sql ? "AND" : "WHERE"} ci.menu_item_id = ?`, [...scope.params, definition.menuItemId]);
        if (contestId === undefined) return checkUnits;
        const serverFilter = serverId === undefined ? "" : "AND server_id = ?";
        const contestUnits = scalar(db, `SELECT COALESCE(SUM(quantity), 0) AS value FROM contest_score_entries WHERE contest_id = ? AND menu_item_id = ? ${serverFilter}`, serverId === undefined ? [contestId, definition.menuItemId] : [contestId, definition.menuItemId, serverId]);
        return checkUnits + contestUnits;
      }
  }
}

export function getHouseMetric(db: Database.Database, definition: MetricDefinition, contestId?: number) {
  return getMetric(db, definition, undefined, contestId);
}
