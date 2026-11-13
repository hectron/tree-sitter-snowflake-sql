// Object-type vocabulary shared by the generic CREATE / ALTER / DROP / DESCRIBE / UNDROP / SHOW rules.
// Each list is compiled into ONE case-insensitive regex token (multi-word names allow any
// whitespace between words), so adding a type costs no parse-table states.
//
// Only data-pipeline objects are listed (see tmp/BRIEF3_SCOPE.md / BRIEF4.md): administrative
// objects (users, roles, warehouses, accounts, integrations, shares, services, ...) are not supported.
// Types with a dedicated keyword rule (TABLE, VIEW, FUNCTION, PROCEDURE, SCHEMA, DATABASE, ...) are
// handled by those rules; the per-verb tokens in snowflake-ddl.js subtract the ones with dedicated tokens.
export const OBJECT_TYPES = [
  "ALERT", "TAG", "EVENT TABLE", "EXTERNAL TABLE", "INTERACTIVE TABLE", "ICEBERG TABLE", "HYBRID TABLE",
  "DYNAMIC TABLE", "DYNAMIC ICEBERG TABLE", "MATERIALIZED VIEW", "SEMANTIC VIEW",
  "STAGE", "FILE FORMAT", "PIPE", "STREAM", "TASK", "TASK GRAPH", "SEQUENCE",
  "DATA METRIC FUNCTION", "MASKING POLICY", "ROW ACCESS POLICY", "DATABASE ROLE",
];

// Plural / listing targets for SHOW (the first words after SHOW [TERSE]).
export const SHOW_TARGETS = [
  "ALERTS", "COLUMNS", "DATA METRIC FUNCTIONS", "DATABASE ROLES", "DATABASES", "DYNAMIC TABLES",
  "EVENT TABLES", "EXTERNAL TABLES", "FILE FORMATS", "FUNCTIONS", "FUTURE GRANTS", "GRANTS",
  "HYBRID TABLES", "ICEBERG TABLES", "INDEXES", "INTERACTIVE TABLES", "LOCKS", "MASKING POLICIES",
  "MATERIALIZED VIEWS", "OBJECTS", "PARAMETERS", "PIPES", "PRIMARY KEYS", "PROCEDURES",
  "ROW ACCESS POLICIES", "SCHEMAS", "SEMANTIC DIMENSIONS", "SEMANTIC FACTS", "SEMANTIC METRICS",
  "SEMANTIC VIEWS", "SEQUENCES", "STAGES", "STREAMS", "TABLES", "TAGS", "TASK GRAPHS", "TASKS",
  "TRANSACTIONS", "USER FUNCTIONS", "USER PROCEDURES", "VARIABLES", "VIEWS",
];

// Container words that can follow IN / ON / OF / FOR / TO in SHOW clauses
// (ACCOUNT, DATABASE, SCHEMA, TABLE, VIEW, ROLE are plain keywords and handled separately).
export const SCOPE_TYPES = [
  "DATABASE ROLE", "DYNAMIC TABLE", "SEMANTIC VIEW", "TASK", "STREAM",
];

// Compile a word list into a single case-insensitive regex: longest names first, any whitespace between words.
export function words_regex(list) {
  const uniq = [...new Set(list)].sort((a, b) => b.length - a.length);
  const alt = uniq.map(name =>
    name.split(" ").map(w => w.split("").map(c => `[${c.toLowerCase()}${c.toUpperCase()}]`.replace(/\[(\W)\W\]/, "$1")).join("")).join("\\s+")
  ).join("|");
  return new RegExp(alt);
}
