import { comma_list, paren_list } from "../helpers.js";

export default {

  _alter_statement: $ => seq(
    choice(
      $.alter_table,
      $.alter_view,
      $.alter_schema,
      $.alter_database,
      // Snowflake
      $.alter_snowflake_named_object,
      $.alter_snowflake_object,
      $.alter_routine,
    ),
  ),

  alter_table: $ => seq(
    $.keyword_alter,
    optional($.keyword_iceberg),
    $.keyword_table,
    optional($._if_exists),
    $.object_reference,
    $._alter_specifications,
    repeat(
      seq(
        ",",
        $._alter_specifications
      )
    ),
  ),

  _alter_specifications: $ => choice(
    $.add_column,
    // Bare ADD COLUMN continuation: COLUMN col TYPE (after ADD COLUMN c1 TYPE, COLUMN c2 TYPE, ...)
    alias($._bare_add_column, $.add_column),
    // Bare column_definition continuation: col TYPE (after ADD COLUMN IF NOT EXISTS c1 TYPE, c2 TYPE, ...)
    alias($._bare_column_def, $.add_column),
    $.add_constraint,
    $.drop_constraint,
    $.alter_column,
    $.modify_column,
    // Bare column action continuation: col DROP NOT NULL (after ALTER COLUMN c1 DROP NOT NULL, ...)
    alias($._bare_alter_column, $.alter_column),
    $.drop_column,
    // Bare DROP COLUMN continuation: COLUMN IF EXISTS col or bare col (after DROP COLUMN c1, ...)
    alias($._bare_drop_column, $.drop_column),
    $.rename_object,
    $.rename_column,
    // Snowflake: ALTER TABLE t CLUSTER BY (col1, col2)
    $.cluster_by,
    // Snowflake: ALTER TABLE t SET prop = value ...
    seq($.keyword_set, $._snowflake_options),
    // Snowflake: ALTER TABLE t DROP PRIMARY KEY
    seq($.keyword_drop, $._primary_key),
    // Snowflake: ALTER TABLE t DROP CLUSTERING KEY
    seq($.keyword_drop, $.keyword_clustering, $.keyword_key),
    // Snowflake: ALTER TABLE t ADD SEARCH OPTIMIZATION [ON method(cols), ...]
    prec.right(seq($.keyword_add, $.keyword_search, $.keyword_optimization,
      optional(seq($.keyword_on, comma_list($.invocation, true))))),
    // Snowflake Iceberg: CONVERT TO MANAGED, UPGRADE TO ICEBERG VERSION 3, OPTIMIZE (opts)
    // CONVERT TO MANAGED [BASE_LOCATION = '..']
    prec.right(seq($.keyword_convert, $.keyword_to, $.keyword_managed, optional($._snowflake_options))),
    // UPGRADE TO ICEBERG VERSION n
    seq($.keyword_upgrade, $.keyword_to, $.keyword_iceberg, $.keyword_version, $.literal),
    seq($.keyword_optimize, paren_list($.identifier, true)),
    // Snowflake: REFRESH ['metadata path']
    seq($.keyword_refresh, optional($.literal)),
    // Snowflake Iceberg: ADD | DROP | REPLACE PARTITION BY (exprs) [WITH (exprs)]
    seq(choice($.keyword_add, $.keyword_drop, $.keyword_replace), $.keyword_partition, $.keyword_by, paren_list($._expression, true),
      optional(seq($.keyword_with, paren_list($._expression, true)))),
    // Snowflake Iceberg: CREATE | REPLACE | DROP VERSION_TAG [IF [NOT] EXISTS] name [AS OF VERSION n | AS OF TIMESTAMP n] [RETAIN n DAYS|HOURS]
    seq(choice($.keyword_create, $.keyword_replace, $.keyword_drop, $.keyword_alter), $.keyword_version_tag,
      optional(choice($._if_exists, $._if_not_exists)), $.identifier,
      optional(seq($.keyword_as, $.identifier, $.identifier, $.literal)),
      optional(seq($.identifier, $.literal, $.identifier))),
    // Snowflake: DROP SEARCH OPTIMIZATION [ON method(cols), ..]
    prec.right(seq($.keyword_drop, $.keyword_search, $.keyword_optimization,
      optional(seq($.keyword_on, comma_list($.invocation, true))))),
    // Snowflake: ALTER TABLE t SWAP WITH other
    seq($.keyword_swap, $.keyword_with, $.object_reference),
    // Snowflake: ALTER TABLE t ADD | DROP ROW ACCESS POLICY p [ON (cols)] ; SET JOIN POLICY p ..
    $._alter_policy_action,
    // Snowflake: ALTER TABLE t SET TAG a = 'x' / UNSET TAG a / UNSET prop, ..
    seq($.keyword_set, $.tag_assignments),
    seq($.keyword_unset, $.tag_names),
    seq($.keyword_unset, $.identifier),
    // Snowflake: ALTER TABLE t SUSPEND | RESUME RECLUSTER
    seq(choice($.keyword_suspend, $.keyword_resume), $.keyword_recluster),
    // Snowflake: ALTER TABLE t ALTER | MODIFY CONSTRAINT name | PRIMARY KEY .. RELY | NOT ENFORCED ..
    seq(
      choice($.keyword_alter, $.keyword_modify),
      $.keyword_constraint,
      choice($.identifier, $._primary_key, seq($.keyword_unique, $.ordered_columns)),
      repeat1($.constraint_property),
    ),
    // Snowflake: ALTER TABLE t ALTER (c1 DROP NOT NULL, COLUMN c2 COMMENT 'x', ..)
    seq(
      choice($.keyword_alter, $.keyword_modify),
      paren_list(choice(
        alias($._bare_alter_column, $.alter_column),
        seq($.keyword_column, $._bare_alter_column),
      ), true),
    ),
    // Snowflake: ALTER TABLE t RENAME CONSTRAINT a TO b
    seq($.keyword_rename, $.keyword_constraint, $.identifier, $.keyword_to, $.identifier),
    // Snowflake: ADD | DROP DATA METRIC FUNCTION func ON (col, col -> expr) [EXPECTATION name (cond)]
    $._dmf_action,
  ),

  // ADD COLUMN — keyword_add is required to prevent ambiguity with drop_column continuations
  add_column: $ => seq(
    $.keyword_add,
    optional(
      $.keyword_column,
    ),
    optional($._if_not_exists),
    $.column_definition,
  ),

  // Bare ADD COLUMN continuation: COLUMN col TYPE (after ADD COLUMN c1 TYPE, COLUMN c2 TYPE)
  // Requires COLUMN keyword to disambiguate from other specs
  _bare_add_column: $ => seq(
    $.keyword_column,
    optional($._if_not_exists),
    $.column_definition,
  ),

  // Bare column_definition continuation: col TYPE (after ADD COLUMN IF NOT EXISTS c1 TYPE, c2 TYPE)
  // No COLUMN keyword — just a raw column_definition for multi-column ADD without COLUMN on continuations
  _bare_column_def: $ => seq(
    $.column_definition,
  ),

  // ADD [CONSTRAINT name] { PRIMARY KEY | UNIQUE | FOREIGN KEY } (cols) ...
  add_constraint: $ => seq(
    $.keyword_add,
    $.constraint,
  ),

  drop_constraint: $ => seq(
    $.keyword_drop,
    $.keyword_constraint,
    optional($._if_exists),
    $.identifier,
    optional($._drop_behavior),
  ),

  alter_column: $ => seq(
    // TODO constraint management
    $.keyword_alter,
    optional(
      $.keyword_column,
    ),
    field('name', $.identifier),
    $._alter_column_action,
  ),

  // Bare column action for multi-column ALTER: col DROP NOT NULL (no ALTER keyword)
  _bare_alter_column: $ => seq(
    field('name', $.identifier),
    $._alter_column_action,
  ),

  _alter_column_action: $ => choice(
    seq(
      choice(
        $.keyword_set,
        $.keyword_drop,
      ),
      $.keyword_not,
      $.keyword_null,
    ),
    // Snowflake: ALTER COLUMN col NOT NULL (bare, without SET/DROP)
    $._not_null,
    // Snowflake: ALTER COLUMN col COMMENT 'text'
    seq($.keyword_comment, alias($._literal_string, $.literal)),
    seq(
      optional(
        seq(
          $.keyword_set,
          $.keyword_data,
        ),
      ),
      $.keyword_type,
      field('type', $._type),
    ),
    seq($.keyword_set, $.keyword_default, $._expression),
    seq(
      $.keyword_drop,
      $.keyword_default,
    ),
    // Snowflake: SET [WITH] MASKING POLICY p [USING (cols)] [FORCE] | UNSET MASKING POLICY
    seq(
      $.keyword_set,
      optional($.keyword_with),
      $.keyword_masking,
      $.keyword_policy,
      $.object_reference,
      optional(seq($.keyword_using, paren_list($.identifier, true))),
      optional($.keyword_force),
    ),
    seq($.keyword_unset, $.keyword_masking, $.keyword_policy),
    // Snowflake: SET | UNSET PROJECTION POLICY, SET TAG, UNSET TAG
    seq($.keyword_set, $.keyword_projection, $.keyword_policy, $.object_reference),
    seq($.keyword_unset, $.keyword_projection, $.keyword_policy),
    seq($.keyword_set, $.tag_assignments),
    seq($.keyword_unset, $.tag_names),
  ),

  // Snowflake: MODIFY is a synonym of ALTER (ALTER TABLE t MODIFY COLUMN c DROP NOT NULL)
  modify_column: $ => seq(
    $.keyword_modify,
    optional($.keyword_column),
    field('name', $.identifier),
    $._alter_column_action,
  ),

  drop_column: $ => prec.left(seq(
    $.keyword_drop,
    optional($.keyword_column),
    optional($._if_exists),
    field('name', $.identifier),
    repeat(seq(
      ',',
      optional($.keyword_column),
      optional($._if_exists),
      field('name', $.identifier),
    )),
  )),

  // Bare DROP COLUMN continuation: COLUMN IF EXISTS col (no DROP keyword)
  // IF EXISTS is required to disambiguate from ADD COLUMN continuations
  _bare_drop_column: $ => seq(
    $.keyword_column,
    $._if_exists,
    field('name', $.identifier),
  ),

  rename_column: $ => seq(
    $.keyword_rename,
    optional(
      $.keyword_column,
    ),
    field('old_name', $.identifier),
    $.keyword_to,
    field('new_name', $.identifier),
  ),

  alter_view: $ => seq(
    $.keyword_alter,
    $.keyword_view,
    optional($._if_exists),
    $.object_reference,
    $._alter_view_action,
    repeat(seq(',', $._alter_view_action)),
  ),

  _dmf_action: $ => seq(
    choice($.keyword_add, $.keyword_drop, $.keyword_modify),
    $.keyword_data, $.keyword_metric, $.keyword_function,
    $.object_reference,
    $.keyword_on,
    paren_list(choice($.lambda_expression, $.identifier, seq($.keyword_table, '(', $.object_reference, paren_list($.identifier), ')'))),
    repeat(seq(optional(choice($.keyword_add, $.keyword_drop)), $.dmf_expectation)),
  ),

  // EXPECTATION name (VALUE >= 90)
  dmf_expectation: $ => seq(
    $.keyword_expectation,
    $.identifier,
    '(', $._expression, ')',
  ),

  _alter_view_action: $ => choice(
    $._dmf_action,
    $.rename_object,
    $.rename_column,
    seq(choice($.keyword_set, $.keyword_unset), $.keyword_secure),
    seq($.keyword_set, $._snowflake_options),
    seq($.keyword_set, $.tag_assignments),
    seq($.keyword_unset, $.tag_names),
    seq($.keyword_unset, $.identifier),
    $._alter_policy_action,
  ),

  // ADD | DROP | SET <policy clause>:  ROW ACCESS POLICY p ON (cols), JOIN POLICY p ALLOWED JOIN KEYS (..), ..
  _alter_policy_action: $ => seq(
    choice($.keyword_add, $.keyword_drop, $.keyword_set),
    $.policy_clause,
  ),

  // ALTER SCHEMA | DATABASE [IF EXISTS] name { RENAME TO new | SET props | UNSET prop }
  alter_schema: $ => seq(
    $.keyword_alter,
    $.keyword_schema,
    optional($._if_exists),
    $.object_reference,
    $._alter_container_action,
  ),

  alter_database: $ => seq(
    $.keyword_alter,
    $.keyword_database,
    optional($._if_exists),
    $.object_reference,
    $._alter_container_action,
  ),

  _alter_container_action: $ => $._snowflake_alter_actions,

  _drop_behavior: $ => choice(
    $.keyword_cascade,
    $.keyword_restrict,
  ),

  rename_object: $ => seq(
    $.keyword_rename,
    $.keyword_to,
    $.object_reference,
  ),

};
