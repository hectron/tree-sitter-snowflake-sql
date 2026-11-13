import { comma_list, paren_list, wrapped_in_parenthesis } from "../helpers.js";

import create_function_rules from "./create-function.js";
import create_procedure_rules from "./create-procedure.js";

export default {

  _create_statement: $ => seq(
    choice(
      $.create_table,
      $.create_view,
      $.create_function,
      $.create_procedure,
      $.create_database,
      $.create_database_role,
      $.create_policy,
      $.create_index,
      $.create_sequence,
      // Snowflake
      $.create_snowflake_named_object,
      $.create_pipe,
      $.create_stream,
      $.create_task,
      $.create_dynamic_table,
      $.create_snowflake_object,
      $.create_data_metric_function,
      $.create_schema,
      $.create_semantic_view,
    ),
  ),

  // left precedence because 'quoted' table options otherwise conflict with
  // `create function` string bodies; if you remove this precedence you will
  // have to also disable the `_literal_string` choice for the `name` field
  // in =-assigned `table_option`s
  create_table: $ => prec.left(
    seq(
      $.keyword_create,
      optional(choice($._or_replace, $._or_alter)),
      optional(
        choice(
          seq(optional(choice($.keyword_local, $.keyword_global)), $._temporary),
          $.keyword_volatile,
          $.keyword_external,
          $.keyword_iceberg,
          $.keyword_hybrid,
          $.keyword_transient,
        )
      ),
      $.keyword_table,
      optional($._if_not_exists),
      $.object_reference,
      choice(
        seq(
          $.column_definitions,
          repeat($._table_settings),
          optional(
            seq(
              $.keyword_as,
              $._select_statement,
            ),
          )
        ),
        seq(
          repeat($._table_settings),
          seq(
            $.keyword_as,
            $.create_query,
          ),
        ),
        // CREATE ICEBERG TABLE t EXTERNAL_VOLUME = .. CATALOG = .. (no column list, no query)
        repeat1($._table_settings),
        // CREATE TABLE t (a, b) AS SELECT ...
        seq(
          alias($._column_list, $.list),
          repeat($._table_settings),
          $.keyword_as,
          $.create_query,
        ),
        // CREATE TABLE ... CLONE source_table [AT | BEFORE (..)]
        seq($.clone_clause, repeat($._table_settings)),
        // CREATE TABLE ... LIKE other_table (Snowflake clone-structure)
        seq(
          $.keyword_like,
          $.object_reference,
          repeat($._table_settings),
        ),
        // CREATE TABLE t USING TEMPLATE (SELECT ...)
        seq(
          repeat($._table_settings),
          $.keyword_using,
          $.keyword_template,
          wrapped_in_parenthesis($._select_statement),
        ),
        // CREATE TABLE t FROM BACKUP SET s IDENTIFIER 'id'
        seq(
          $.keyword_from,
          $.keyword_backup,
          $.keyword_set,
          $.object_reference,
          $.keyword_identifier,
          $.literal,
        ),
      ),
    ),
  ),

  // CLONE source [AT | BEFORE (..)] [IGNORE TABLES WITH INSUFFICIENT DATA RETENTION] [IGNORE HYBRID TABLES]
  clone_clause: $ => prec.left(seq(
    $.keyword_clone,
    $.object_reference,
    optional($.at_before),
    repeat($.ignore_clause),
  )),

  ignore_clause: $ => choice(
    seq($.keyword_ignore, $.keyword_hybrid, $.keyword_tables),
    seq($.keyword_ignore, $.keyword_tables, $.keyword_with, $.keyword_insufficient, $.keyword_data, $.keyword_retention),
  ),

  _table_settings: $ => choice(
    $.table_partition,
    $.cluster_by,
    $.table_option,
    $.copy_clause,
    $.with_tag_clause,
    $.policy_clause,
    $.contact_clause,
  ),

  // COPY GRANTS | COPY TAGS | COPY = (COMMENTS, TAGS, GRANTS)
  copy_clause: $ => seq(
    $.keyword_copy,
    choice(
      $.keyword_grants,
      $.keyword_tags,
      seq('=', paren_list($.identifier, true)),
    ),
  ),

  // [WITH] ROW ACCESS | AGGREGATION | JOIN | STORAGE LIFECYCLE POLICY name [ON (cols)] [ENTITY KEY (cols)] [ALLOWED JOIN KEYS (cols)]
  policy_clause: $ => prec.left(seq(
    optional($.keyword_with),
    choice(
      seq($.keyword_row, $.keyword_access),
      $.keyword_aggregation,
      $.keyword_join,
      seq($.keyword_storage, $.keyword_lifecycle),
    ),
    $.keyword_policy,
    $.object_reference,
    repeat(choice(
      seq($.keyword_on, $._policy_columns),
      seq($.keyword_entity, $.keyword_key, $._policy_columns),
      seq($.keyword_allowed, $.keyword_join, $.keyword_keys, $._policy_columns),
    )),
  )),

  _policy_columns: $ => paren_list($.identifier, true),

  // WITH CONTACT (purpose = contact_name, ..)
  contact_clause: $ => seq(
    $.keyword_with,
    $.keyword_contact,
    '(',
    $._snowflake_options,
    ')',
  ),

  // Snowflake: CLUSTER BY (col1, col2, expr)
  cluster_by: $ => seq(
    $.keyword_cluster,
    $.keyword_by,
    paren_list($._expression, true),
  ),

  // Snowflake Iceberg: PARTITION BY (col, MONTH(col), BUCKET(8, col), ...)
  table_partition: $ => seq(
    $.keyword_partition,
    $.keyword_by,
    paren_list($._expression, true),
  ),

  table_option: $ => choice(
    seq($.keyword_collate, $.identifier),
    field('name', $.keyword_default),
    seq(
      field('name', choice($.identifier, $._literal_string)),
      '=',
      field('value', $._property_value),
    ),
  ),

  create_query: $ => choice(
    $._dml_read,
    // AS ( WITH cte AS (...) SELECT ... )
    wrapped_in_parenthesis(seq($._cte, choice($._select_statement, $.set_operation))),
  ),

  // Snowflake: CREATE VIEW v (col [COMMENT '..'], ...)
  view_columns: $ => paren_list($.view_column, true),

  view_column: $ => seq(
    field('name', $.identifier),
    optional($._column_comment),
  ),

  create_view: $ => prec.right(
    seq(
      $.keyword_create,
      optional(choice($._or_replace, $._or_alter)),
      optional($.keyword_secure),
      optional($._temporary),
      optional($.keyword_recursive),
      optional(choice($.keyword_materialized, seq($.keyword_interactive, $.keyword_materialized))),
      $.keyword_view,
      optional($._if_not_exists),
      $.object_reference,
      optional($.view_columns),
      // Snowflake: COPY GRANTS, COMMENT = '...', CLUSTER BY (..) (materialized views)
      repeat(choice(
        $.procedure_comment,
        $._table_settings,
        seq(
          $.keyword_with, $.keyword_data, $.keyword_metric, $.keyword_function,
          '(', $.object_reference, $.keyword_on, paren_list(choice($.lambda_expression, $.identifier)),
          repeat($.dmf_expectation), ')',
        ),
      )),
      $.keyword_as,
      $.create_query,
    ),
  ),

  ...create_function_rules,
  ...create_procedure_rules,

  // Snowflake: CREATE [OR REPLACE] [TRANSIENT] SCHEMA | DATABASE [IF NOT EXISTS] name
  //            [CLONE source] [properties]
  create_schema: $ => prec.left(seq(
    $.keyword_create,
    optional(choice($._or_replace, $._or_alter)),
    optional($.keyword_transient),
    $.keyword_schema,
    optional($._if_not_exists),
    $.object_reference,
    optional($.clone_clause),
    optional(seq(optional($.keyword_with), $.keyword_managed, $.keyword_access)),
    optional($._snowflake_options),
  )),

  create_database: $ => prec.left(seq(
    $.keyword_create,
    optional(choice($._or_replace, $._or_alter)),
    optional($.keyword_transient),
    $.keyword_database,
    optional($._if_not_exists),
    $.object_reference,
    optional($.clone_clause),
    optional($._snowflake_options),
  )),

  // Snowflake hybrid tables: CREATE [OR REPLACE] INDEX [IF NOT EXISTS] name ON table (cols) [INCLUDE (cols)]
  create_index: $ => seq(
    $.keyword_create,
    optional($._or_replace),
    $.keyword_index,
    optional($._if_not_exists),
    $.object_reference,
    $.keyword_on,
    $.object_reference,
    $.ordered_columns,
    optional(seq($.keyword_include, $.ordered_columns)),
  ),

  // Snowflake: CREATE [OR REPLACE] { MASKING | ROW ACCESS } POLICY [IF NOT EXISTS] name
  //            AS (arg type, ..) RETURNS type -> expr [COMMENT = '..'] [EXEMPT_OTHER_POLICIES = bool]
  create_policy: $ => prec.left(seq(
    $.keyword_create,
    optional(choice($._or_replace, $._or_alter)),
    choice($.keyword_masking, seq($.keyword_row, $.keyword_access)),
    $.keyword_policy,
    optional($._if_not_exists),
    $.object_reference,
    $.keyword_as,
    $.function_arguments,
    $.keyword_returns,
    $._type,
    '->',
    $._expression,
    optional($._snowflake_options),
  )),

  // Snowflake: CREATE [OR REPLACE] DATABASE ROLE [IF NOT EXISTS] name [COMMENT = ..]
  create_database_role: $ => prec.left(seq(
    $.keyword_create,
    optional($._or_replace),
    $.keyword_database, $.keyword_role,
    optional($._if_not_exists),
    $.object_reference,
    optional($._snowflake_options),
  )),

  // Snowflake: CREATE [OR REPLACE] SEQUENCE [IF NOT EXISTS] name
  //            [START [WITH] [=] n] [INCREMENT [BY] [=] n] [ORDER | NOORDER] [COMMENT = '..']
  create_sequence: $ => seq(
    $.keyword_create,
    optional($._or_replace),
    $.keyword_sequence,
    optional($._if_not_exists),
    $.object_reference,
    repeat(
      choice(
        seq($.keyword_increment, optional(choice($.keyword_by, '=')), field("increment", alias($._integer, $.literal))),
        seq($.keyword_start, optional(choice($.keyword_with, '=')), field("start", alias($._integer, $.literal))),
        $.keyword_order,
        $.keyword_noorder,
        $.table_option,
      )
    ),
  ),

};
