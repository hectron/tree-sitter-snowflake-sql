import { comma_list, paren_list, wrapped_in_parenthesis } from "../helpers.js";
import { OBJECT_TYPES, SHOW_TARGETS, SCOPE_TYPES, words_regex } from "../object-types.js";

// Which object types have a dedicated token/rule for each verb (they are excluded from the generic token)
const without = (list, drop) => list.filter(t => !drop.includes(t));
const DEDICATED_CREATE = ["FILE FORMAT", "STAGE", "PIPE", "STREAM", "TASK", "SEQUENCE", "MATERIALIZED VIEW",
  "DYNAMIC TABLE", "DYNAMIC ICEBERG TABLE", "ICEBERG TABLE", "HYBRID TABLE", "DATA METRIC FUNCTION", "MASKING POLICY",
  "ROW ACCESS POLICY", "DATABASE ROLE", "SEMANTIC VIEW"];
const NAMED_ALTER = ["STAGE", "PIPE", "STREAM", "TASK", "DYNAMIC TABLE", "DYNAMIC ICEBERG TABLE", "SEQUENCE",
  "MATERIALIZED VIEW"];
const NAMED_DROP = ["STAGE", "FILE FORMAT", "PIPE", "STREAM", "TASK", "SEQUENCE", "MATERIALIZED VIEW",
  "DYNAMIC TABLE", "DYNAMIC ICEBERG TABLE"];
const KEYWORD_DESCRIBE = ["STAGE", "PIPE", "STREAM", "TASK", "DATA METRIC FUNCTION"];


export default {

  // --- Umbrella rule for all new Snowflake statements ---
  // Named rule (not _prefixed) so tree-sitter doesn't inline it,
  // keeping it as a single choice in _ddl_statement to minimize state explosion
  snowflake_statement: $ => choice(
    $.describe_statement,
    $.use_statement,
    $.unset_statement,
    $.call_statement,
    $.call_with_procedure,
    $.execute_statement,
    $.undrop_statement,
    $.put_statement,
    $.get_statement,
    $.list_statement,
    $.remove_statement,
    $.copy_files_statement,
    $.snowflake_show_statement,
    $.pipe_query,
    $.alter_session,
  ),

  // --- ALTER SESSION ---
  // ALTER SESSION SET param = value | ALTER SESSION UNSET param
  alter_session: $ => seq(
    $.keyword_alter, $.keyword_session,
    choice(
      seq($.keyword_set, $._snowflake_options),
      seq($.keyword_unset, $.identifier),
    ),
  ),

  // --- Snowflake property helpers ---
  // A single key=value property (used in CREATE/ALTER options)
  _snowflake_property: $ => seq(
    field('name', choice($.identifier, $.keyword_comment)),
    '=',
    field('value', $._property_value),
  ),

  // property whose name is a plain identifier (COMMENT is handled by dedicated rules)
  _plain_property: $ => seq(
    field('name', $.identifier),
    '=',
    field('value', $._property_value),
  ),

  _property_value: $ => choice(
    alias($._plain_literal, $.literal),
    $.identifier,
    alias($._dotted_reference, $.object_reference),
    $.stage_reference,
    $.snowflake_variable_reference,
    // nested properties: REST_CONFIG = (CATALOG_URI = '..' ..)
    seq('(', $._snowflake_options, ')'),
    // value lists: NULL_IF = ('NULL', 'null'), NOTIFY_USERS = (a, "b c"), ()
    alias($._property_list, $.list),
  ),

  _property_list: $ => paren_list(choice($._property_value, $.aliased_value)),

  // IMPORTS = ('@stage/dir/' AS 'state')
  aliased_value: $ => seq($._property_value, $.keyword_as, $._property_value),

  _dotted_reference: $ => seq($.identifier, '.', $.identifier, optional(seq('.', $.identifier))),

  // literal without the TYPE 'string' casting form (so adjacent values stay unambiguous)
  _plain_literal: $ => choice(
    $._integer,
    $._decimal_number,
    $._literal_string,
    $.keyword_true,
    $.keyword_false,
    $.keyword_null,
  ),

  // A block of properties, optionally comma-separated
  _snowflake_options: $ => prec.left(seq(
    $._snowflake_property,
    repeat(seq(optional(','), $._snowflake_property)),
  )),

  // --- CREATE rules for simple Snowflake objects ---
  // Consolidated create for STAGE, FILE FORMAT
  // Uses regex token to avoid 3 separate rules in _create_statement
  snowflake_create_object_type: _ => /[sS][tT][aA][gG][eE]|[fF][iI][lL][eE][\s_]+[fF][oO][rR][mM][aA][tT]/,

  create_snowflake_named_object: $ => prec.left(seq(
    $.keyword_create,
    optional(choice($._or_replace, $._or_alter)),
    optional($._temporary),
    $.snowflake_create_object_type,
    optional($._if_not_exists),
    choice($.object_reference, $.stage_reference),
    optional($._snowflake_options),
  )),

  // --- CREATE PIPE ---
  create_pipe: $ => prec.left(seq(
    $.keyword_create,
    optional(choice($._or_replace, $._or_alter)),
    $.keyword_pipe,
    optional($._if_not_exists),
    $.object_reference,
    optional($._snowflake_options),
    $.keyword_as,
    choice($.statement, wrapped_in_parenthesis($.statement)),
  )),

  // --- CREATE STREAM ---
  create_stream: $ => prec.left(seq(
    $.keyword_create,
    optional(choice($._or_replace, $._or_alter)),
    $.keyword_stream,
    optional($._if_not_exists),
    $.object_reference,
    optional($.copy_clause),
    optional(seq(
      $.keyword_on,
      choice(
        seq(optional($.keyword_event), $.keyword_table),
        $.keyword_view,
        $.keyword_stage,
        seq($.keyword_dynamic, $.keyword_table),
        seq($.keyword_external, $.keyword_table),
      ),
      $.object_reference,
      optional($.at_before),
    )),
    repeat(seq(optional(','), choice($._snowflake_property, $.copy_clause))),
  )),

  // --- CREATE TASK ---
  create_task: $ => prec.left(seq(
    $.keyword_create,
    optional(choice($._or_replace, $._or_alter)),
    $.keyword_task,
    optional($._if_not_exists),
    $.object_reference,
    repeat(choice(
      $._snowflake_options,
      seq($.keyword_after, comma_list($.object_reference, true)),
      seq($.keyword_when, $._expression),
    )),
    $.keyword_as,
    choice(
      $.snowflake_scripting_block,
      $.statement,
    ),
  )),

  // --- CREATE DYNAMIC TABLE ---
  create_dynamic_table: $ => prec.left(seq(
    $.keyword_create,
    optional(choice($._or_replace, $._or_alter)),
    optional($.keyword_transient),
    $.keyword_dynamic,
    optional($.keyword_iceberg),
    $.keyword_table,
    optional($._if_not_exists),
    $.object_reference,
    optional(choice($.column_definitions, $.view_columns)),
    repeat(seq(optional(','), $._dynamic_table_setting)),
    choice(
      seq($.keyword_as, $._select_statement, optional($.copy_clause)),
      seq($.clone_clause, repeat($._dynamic_table_setting)),
    ),
  )),

  _dynamic_table_setting: $ => choice(
    $._snowflake_property,
    $.cluster_by,
    $.copy_clause,
    $.with_tag_clause,
    $.policy_clause,
    $.contact_clause,
    seq($.keyword_require, $.keyword_user),
    // FROZEN WHERE (predicate)
    seq($.keyword_frozen, $.keyword_where, wrapped_in_parenthesis($._expression)),
  ),

  // --- DROP rules for Snowflake objects ---
  // Consolidated drop for STAGE, FILE FORMAT, PIPE, STREAM, TASK, SEQUENCE, MATERIALIZED VIEW, DYNAMIC TABLE
  // Uses regex token to avoid 6 separate rules in _drop_statement
  snowflake_drop_object_type: _ => /[dD][yY][nN][aA][mM][iI][cC]\s+([iI][cC][eE][bB][eE][rR][gG]\s+)?[tT][aA][bB][lL][eE]|[sS][tT][aA][gG][eE]|[fF][iI][lL][eE][\s_]+[fF][oO][rR][mM][aA][tT]|[pP][iI][pP][eE]|[sS][tT][rR][eE][aA][mM]|[tT][aA][sS][kK]|[sS][eE][qQ][uU][eE][nN][cC][eE]|[mM][aA][tT][eE][rR][iI][aA][lL][iI][zZ][eE][dD]\s+[vV][iI][eE][wW]/,

  drop_snowflake_named_object: $ => seq(
    $.keyword_drop,
    $.snowflake_drop_object_type,
    optional($._if_exists),
    choice($.object_reference, $.stage_reference),
  ),

  // --- ALTER rules for Snowflake objects ---
  // Structured ALTER actions shared by the named and generic ALTER statements
  _snowflake_alter_actions: $ => choice(
    // ALTER ALERT a FROM TEMPLATE t SET ..
    seq($.keyword_from, $.keyword_template, $.identifier, $.keyword_set, $._snowflake_options),
    seq($.keyword_set, $._snowflake_options),
    seq($.keyword_set, $.tag_assignments),
    seq($.keyword_unset, $.tag_names),
    // UNSET name [, name ..]
    seq($.keyword_unset, comma_list($.identifier, true)),
    // SET | UNSET SECURE (functions, materialized views)
    seq(choice($.keyword_set, $.keyword_unset), $.keyword_secure),
    // ALTER MASKING | ROW ACCESS POLICY p SET BODY -> expr
    seq($.keyword_set, $.keyword_body, '->', $._expression),
    $.rename_object,
    // SUSPEND | RESUME [RECLUSTER | MATERIALIZATION name]
    seq(
      choice($.keyword_suspend, $.keyword_resume),
      optional(choice($.keyword_recluster, $.keyword_discovery, seq($.keyword_materialization, $.identifier))),
    ),
    $.refresh_action,
    // ALTER TASK ... MODIFY AS body | MODIFY WHEN expr
    seq($.keyword_modify, choice(
      seq($.keyword_as, choice($.snowflake_scripting_block, $.statement)),
      seq($.keyword_when, $._expression),
    )),
    // ALTER TASK ... ADD AFTER task | REMOVE AFTER task
    seq($.keyword_add, $.keyword_after, comma_list($.object_reference, true)),
    seq($.keyword_remove, $.keyword_after, comma_list($.object_reference, true)),
    // ALTER EXTERNAL TABLE t ADD | REMOVE FILES ('a', 'b')
    seq(choice($.keyword_add, $.keyword_remove), $.keyword_files, paren_list(alias($._literal_string, $.literal), true)),
    // ALTER EXTERNAL TABLE t ADD PARTITION (c = 'v', ..) LOCATION 'p' | DROP PARTITION LOCATION 'p'
    seq($.keyword_add, $.keyword_partition, '(', $._snowflake_options, ')', $.keyword_location, alias($._literal_string, $.literal)),
    seq($.keyword_drop, $.keyword_partition, $.keyword_location, alias($._literal_string, $.literal)),
    // ALTER SEMANTIC VIEW v DROP MATERIALIZATION m
    seq($.keyword_drop, $.keyword_materialization, $.identifier),
    // table-like maintenance (dynamic tables, materialized views)
    seq($.keyword_swap, $.keyword_with, $.object_reference),
    $.cluster_by,
    seq($.keyword_drop, $.keyword_clustering, $.keyword_key),
    prec.right(seq(choice($.keyword_add, $.keyword_drop), $.keyword_search, $.keyword_optimization,
      optional(seq($.keyword_on, comma_list($.invocation, true))))),
    seq(choice($.keyword_add, $.keyword_drop), $.policy_clause),
    seq($.keyword_drop, $.keyword_storage, $.keyword_lifecycle, $.keyword_policy),
    // ALTER SCHEMA s ENABLE | DISABLE MANAGED ACCESS
    seq(choice($.keyword_enable, $.keyword_disable), $.keyword_managed, $.keyword_access),
    // ALTER TASK GRAPH g COMMIT
    $.keyword_commit,
    // ALTER DYNAMIC TABLE t UNSET FROZEN WHERE
    seq($.keyword_unset, $.keyword_frozen, $.keyword_where),
  ),

  // REFRESH ['path'] | REFRESH PREFIX = '..' MODIFIED_AFTER = '..' | REFRESH SUBPATH = '..'
  // | REFRESH COPY SESSION | REFRESH MATERIALIZATION name
  refresh_action: $ => prec.right(seq(
    $.keyword_refresh,
    optional(choice(
      alias($._literal_string, $.literal),
      $._snowflake_options,
      seq($.keyword_copy, $.keyword_session),
      seq($.keyword_materialization, $.identifier),
    )),
  )),

  // SET TAG a = 'x', b.c = 'y'
  tag_assignments: $ => seq(
    $.keyword_tag,
    comma_list($.tag_assignment, true),
  ),

  tag_assignment: $ => seq(
    field('name', $.object_reference),
    '=',
    field('value', $.literal),
  ),

  // UNSET TAG a, b.c
  tag_names: $ => seq(
    $.keyword_tag,
    comma_list($.object_reference, true),
  ),

  // Consolidated alter for STAGE, PIPE, STREAM, TASK, DYNAMIC [ICEBERG] TABLE,
  // SEQUENCE, MATERIALIZED VIEW
  // Uses regex token to avoid 5 separate rules in _alter_statement
  snowflake_alter_object_type: _ => /[sS][tT][aA][gG][eE]|[pP][iI][pP][eE]|[sS][tT][rR][eE][aA][mM]|[tT][aA][sS][kK]|[dD][yY][nN][aA][mM][iI][cC]\s+([iI][cC][eE][bB][eE][rR][gG]\s+)?[tT][aA][bB][lL][eE]|[sS][eE][qQ][uU][eE][nN][cC][eE]|[mM][aA][tT][eE][rR][iI][aA][lL][iI][zZ][eE][dD]\s+[vV][iI][eE][wW]/,

  alter_snowflake_named_object: $ => prec.left(seq(
    $.keyword_alter,
    $.snowflake_alter_object_type,
    optional($._if_exists),
    $.object_reference,
    $._snowflake_alter_actions,
  )),

  // --- Generic Snowflake object types (ALERT, TAG, EVENT TABLE, EXTERNAL TABLE, TASK GRAPH, ...) ---
  // Uses a single regex token for the object type keyword to avoid state explosion (grammar/object-types.js)
  snowflake_object_type: _ => words_regex(without(OBJECT_TYPES, DEDICATED_CREATE)),

  // object-type tokens for the other verbs; presented as snowflake_object_type nodes
  _alter_object_type: _ => words_regex(without(OBJECT_TYPES, [...NAMED_ALTER, "ICEBERG TABLE", "HYBRID TABLE"])),
  _undrop_object_type: _ => words_regex(OBJECT_TYPES),
  _drop_object_type: _ => words_regex(without(OBJECT_TYPES, NAMED_DROP)),
  _describe_object_type_token: _ => token(prec(1, words_regex(without(OBJECT_TYPES, KEYWORD_DESCRIBE)))),

  create_snowflake_object: $ => prec.left(seq(
    $.keyword_create,
    optional(choice($._or_replace, $._or_alter)),
    optional(choice($.keyword_secure, $._temporary)),
    $.snowflake_object_type,
    optional($._if_not_exists),
    $.object_reference,
    optional($.column_definitions),
    repeat(seq(optional(','), $._generic_option)),
    optional(choice($.alert_condition, $._generic_tail)),
  )),

  // FROM <source> | AS <body> after the property list of a generic object
  _generic_tail: $ => seq(
    $.keyword_as,
    choice(
      $.statement,
      $.snowflake_scripting_block,
      $.literal,
      // policies: AS (args) [RETURNS type] -> expression
      seq($.function_arguments, optional(seq($.keyword_returns, $._type)), '->', $._expression),
    ),
  ),

  // CREATE ALERT ... IF (EXISTS (<query>)) THEN <action>
  alert_condition: $ => seq(
    $.keyword_if,
    '(',
    $.exists,
    ')',
    $.keyword_then,
    choice($.snowflake_scripting_block, $.statement),
  ),

  drop_snowflake_object: $ => seq(
    $.keyword_drop,
    alias($._drop_object_type, $.snowflake_object_type),
    optional($._if_exists),
    $.object_reference,
    optional($._drop_behavior),
    optional(choice($.keyword_purge, $.keyword_nopurge)),
  ),

  alter_snowflake_object: $ => prec.left(seq(
    $.keyword_alter,
    alias($._alter_object_type, $.snowflake_object_type),
    optional($._if_exists),
    $.object_reference,
    $._snowflake_alter_actions,
  )),

  // ALTER PROCEDURE|FUNCTION [IF EXISTS] name(arg_type, ...) SET|UNSET|RENAME ...
  alter_routine: $ => prec.left(seq(
    $.keyword_alter,
    choice($.keyword_procedure, $.keyword_function),
    optional($._if_exists),
    $.object_reference,
    $.function_arguments,
    $._snowflake_alter_actions,
  )),

  // --- CREATE DATA METRIC FUNCTION ---
  // CREATE [OR REPLACE] DATA METRIC FUNCTION [IF NOT EXISTS] name(ARG_T TABLE(col type, ...))
  // RETURNS NUMBER [COMMENT = 'text'] AS $$ body $$
  create_data_metric_function: $ => prec.left(seq(
    $.keyword_create,
    optional(choice($._or_replace, $._or_alter)),
    optional($.keyword_secure),
    $.keyword_data,
    $.keyword_metric,
    $.keyword_function,
    optional($._if_not_exists),
    $.object_reference,
    paren_list(seq(field('arg_name', $.identifier), $.keyword_table, $.column_definitions), true),
    $.keyword_returns,
    $._type,
    optional(seq($.keyword_comment, '=', alias($._literal_string, $.literal))),
    $.keyword_as,
    choice(
      seq(
        alias($._dollar_quoted_string_start_tag, $.dollar_quote),
        $.statement,
        optional(';'),
        alias($._dollar_quoted_string_end_tag, $.dollar_quote),
      ),
      // AS 'SELECT ...' (single-quoted body)
      alias($._single_quote_string, $.literal),
    ),
  )),

  // --- Snowflake COPY INTO ---
  snowflake_copy_into: $ => prec.left(seq(
    $.keyword_copy, $.keyword_into,
    $._copy_location,
    // COPY INTO table (col1, col2, ...) FROM ...
    optional(alias($._column_list, $.list)),
    optional(seq(
      $.keyword_from,
      choice(
        $._copy_location,
        seq('(', $._select_statement, ')'),
      ),
    )),
    // unload: PARTITION BY expr
    optional($.partition_by),
    optional($._snowflake_options),
  )),

  _copy_location: $ => choice(
    $.object_reference,
    $.stage_reference,
    $.external_location,
    alias($._single_quote_string, $.literal),
  ),

  // --- DESCRIBE statement ---
  // DESCRIBE [object_type] object_name
  // Hidden rule using keyword references to avoid regex/keyword token conflict.
  // (A regex token matching TABLE would lose to keyword_table, breaking parsing.)
  _describe_object_type: $ => choice(
    $.keyword_table, $.keyword_view, $.keyword_schema, $.keyword_database,
    $.keyword_stage, $.keyword_pipe, $.keyword_stream, $.keyword_task,
    $.keyword_function, $.keyword_procedure,
    alias($._describe_object_type_token, $.snowflake_object_type),
  ),

  describe_statement: $ => prec.left(seq(
    $.keyword_describe,
    optional($._describe_object_type),
    $.object_reference,
    optional($.function_arguments),
    optional($._snowflake_options),
  )),

  // --- USE statement ---
  // USE DATABASE|SCHEMA|WAREHOUSE|ROLE name
  use_statement: $ => seq(
    $.keyword_use,
    choice(
      seq(
        optional(choice($.keyword_database, $.keyword_schema, $.keyword_warehouse, $.keyword_role)),
        choice($.object_reference, alias($._single_quote_string, $.literal)),
      ),
    ),
  ),

  // UNSET var [, var ..]
  unset_statement: $ => seq($.keyword_unset, choice(comma_list($.identifier, true), paren_list($.identifier, true))),

  // --- CALL statement ---
  // CALL procedure_name(args...)
  call_statement: $ => seq(
    $.keyword_call,
    $.invocation,
    // CALL proc(...) INTO :result_var
    optional(seq($.keyword_into, choice($.snowflake_variable_reference, $.identifier))),
  ),

  // --- EXECUTE TASK / EXECUTE IMMEDIATE ---
  execute_statement: $ => seq(
    $.keyword_execute,
    choice(
      seq(
        $.keyword_task, $.object_reference,
        optional(choice(
          $.keyword_await,
          seq($.keyword_retry, $.keyword_last),
          seq($.keyword_retry, $.keyword_graph, $.keyword_run, $.keyword_group, alias($._literal_string, $.literal)),
        )),
        optional(seq($.keyword_using, $._snowflake_property)),
      ),
      // EXECUTE USING POLICY_CONTEXT(k => v, ..) AS <query>
      seq($.keyword_using, $.keyword_policy_context, paren_list($.named_parameter, true), $.keyword_as, $._dml_read),
      // EXECUTE IMMEDIATE FROM @stage/file.sql [USING (name => value, ..)]
      seq(
        $.keyword_immediate, $.keyword_from, choice($.stage_reference, $.literal, $.object_reference),
        optional(seq($.keyword_using, paren_list($.named_parameter, true))),
      ),
      // EXECUTE ALERT name
      seq($.keyword_alert, $.object_reference),
      // Dollar-quoted scripting block: EXECUTE IMMEDIATE $$ BEGIN ... END $$
      // Higher precedence ensures this is preferred over the _expression fallback
      // which would consume $$...$$ as an opaque literal string
      prec(1, seq(
        $.keyword_immediate,
        alias($._dollar_quoted_string_start_tag, $.dollar_quote),
        $.snowflake_scripting_block,
        optional(';'),
        alias($._dollar_quoted_string_end_tag, $.dollar_quote),
      )),
      // Dollar-quoted single statement: EXECUTE IMMEDIATE $$ CREATE ALERT ... $$
      prec(1, seq(
        $.keyword_immediate,
        alias($._dollar_quoted_string_start_tag, $.dollar_quote),
        $.statement,
        optional(';'),
        alias($._dollar_quoted_string_end_tag, $.dollar_quote),
      )),
      // Fallback: EXECUTE IMMEDIATE 'string' or EXECUTE IMMEDIATE :var or EXECUTE IMMEDIATE expr
      seq($.keyword_immediate, $._expression, optional(seq($.keyword_using, $.list))),
    ),
  ),

  // one option of a generic CREATE / ALTER statement
  _generic_option: $ => choice(
    $._snowflake_property,
    seq($.keyword_with, $._snowflake_property),
    // TASK GRAPH: TASK_DEFAULTS (k = v, ..)
    seq($.keyword_task_defaults, '(', $._snowflake_options, ')'),
    // TAG: ALLOWED_VALUES 'a', 'b'
    prec.right(seq($.keyword_allowed_values, comma_list(alias($._plain_literal, $.literal), true))),
    $.table_partition,
    // ALERT: FROM TEMPLATE name
    seq($.keyword_from, $.keyword_template, $.identifier),
    seq($.keyword_using, $.keyword_template, wrapped_in_parenthesis($._select_statement)),
    $.with_tag_clause,
    $.clone_clause,
    $.copy_clause,
    $.cluster_by,
  ),

  // --- UNDROP ---
  // UNDROP TABLE|SCHEMA|DATABASE name
  undrop_statement: $ => seq(
    $.keyword_undrop,
    choice(
      $.keyword_table,
      $.keyword_schema,
      $.keyword_database,
      alias($._undrop_object_type, $.snowflake_object_type),
    ),
    $.object_reference,
  ),

  // --- PUT / GET / LIST / REMOVE ---
  // file://path/to/file (local path for PUT / GET)
  file_url: _ => /[fF][iI][lL][eE]:\/\/[^\s;'"]+/,

  // s3://bucket/path, gcs://.., azure://.. given without quotes
  external_location: _ => /([sS]3([gG][oO][vV])?|[gG][cC][sS]|[aA][zZ][uU][rR][eE]):\/\/[^\s;,)'"]+/,

  // PUT file_path @stage [options]
  put_statement: $ => prec.left(seq(
    $.keyword_put,
    choice($.literal, $.file_url),
    $.stage_reference,
    optional($._snowflake_options),
  )),

  // GET @stage file_path [options]
  get_statement: $ => prec.left(seq(
    $.keyword_get,
    $.stage_reference,
    choice($.literal, $.file_url, $.identifier),
    optional($._snowflake_options),
  )),

  // LIST | LS @stage[/path] [PATTERN = 'regex']
  list_statement: $ => prec.left(seq(
    choice($.keyword_list, $.keyword_ls),
    $.stage_reference,
    optional(seq($.keyword_pattern, '=', $.literal)),
  )),

  // REMOVE | RM @stage[/path] [PATTERN = 'regex']
  remove_statement: $ => prec.left(seq(
    choice($.keyword_remove, $.keyword_rm),
    $.stage_reference,
    optional(seq($.keyword_pattern, '=', $.literal)),
  )),

  // COPY FILES INTO @target FROM @source [FILES = (..) | PATTERN = '..'] [DETAILED_OUTPUT = TRUE]
  copy_files_statement: $ => prec.left(seq(
    $.keyword_copy, $.keyword_files,
    $.keyword_into, $.stage_reference,
    $.keyword_from, $.stage_reference,
    optional($._snowflake_options),
  )),

  // --- GRANT / REVOKE ---
  // Privilege grants (incl. OWNERSHIP and CALLER) on data objects, role grants (ROLE / DATABASE ROLE)
  // to ROLE / DATABASE ROLE grantees, and the CURRENT GRANTS / GRANT OPTION modifiers.
  grant_statement: $ => prec.left(seq(
    $.keyword_grant,
    choice(
      seq($._grant_privileges, $.keyword_on, $._grant_target),
      $._grant_role,
    ),
    $.keyword_to, $._grant_grantee,
    optional(seq(
      $.keyword_with,
      $.keyword_grant,
      $.keyword_option,
    )),
    optional($._current_grants),
  )),

  revoke_statement: $ => prec.left(seq(
    $.keyword_revoke,
    optional(seq($.keyword_grant, $.keyword_option, $.keyword_for)),
    choice(
      seq($._grant_privileges, $.keyword_on, $._grant_target),
      $._grant_role,
    ),
    $.keyword_from, $._grant_grantee,
    optional($.keyword_restrict),
    optional($.keyword_cascade),
  )),

  // [DATABASE] ROLE name
  _grant_role: $ => seq(
    optional($.keyword_database),
    $.keyword_role,
    $._grant_name,
  ),

  // COPY CURRENT GRANTS | REVOKE CURRENT GRANTS
  _current_grants: $ => seq(choice($.keyword_copy, $.keyword_revoke), $.keyword_current, $.keyword_grants),

  // a role name: plain identifier or dotted database role (db.role)
  _grant_name: $ => choice(
    $.identifier,
    alias($._dotted_reference, $.object_reference),
  ),

  // GRANT/REVOKE target: [type] name[(arg types)] | { ALL | FUTURE } <objects> IN { SCHEMA | DATABASE name | ACCOUNT }
  _grant_target: $ => choice(
    seq(
      optional($._grant_object_type),
      $.object_reference,
      optional($.function_arguments),
    ),
    seq(
      choice($.keyword_all, $.keyword_future),
      alias($.snowflake_show_target, $.snowflake_object_type),
      $.keyword_in,
      choice(
        seq(choice($.keyword_schema, $.keyword_database), $.object_reference),
        $.keyword_account,
      ),
    ),
  ),

  // [INHERITED] CALLER and multi-word privileges (CREATE MATERIALIZED VIEW, APPLY MASKING POLICY, ...)
  _grant_privileges: $ => choice(
    seq($.keyword_all, optional(seq(optional($.keyword_inherited), $.keyword_caller)), optional($.keyword_privileges)),
    seq(
      optional(seq(optional($.keyword_inherited), $.keyword_caller)),
      comma_list($.privilege, true),
    ),
  ),

  // one privilege: its words (SELECT, CREATE MATERIALIZED VIEW, APPLY MASKING POLICY)
  privilege: $ => repeat1($.identifier),

  // Grant object type: existing keywords, plus the generic type vocabulary for everything else
  _grant_object_type: $ => choice(
    $.keyword_table,
    $.keyword_view,
    $.keyword_schema,
    $.keyword_database,
    $.keyword_stage,
    $.keyword_procedure,
    $.keyword_function,
    $.keyword_task,
    $.keyword_stream,
    $.keyword_pipe,
    $.keyword_sequence,
    seq($.keyword_dynamic, $.keyword_table),
    alias($._grant_type_token, $.snowflake_object_type),
  ),

  _grant_type_token: _ => token(prec(1, words_regex(
    without(OBJECT_TYPES, ["STAGE", "PIPE", "STREAM", "TASK", "SEQUENCE", "DYNAMIC TABLE"]),
  ))),

  _grant_grantee: $ => choice(
    seq($.keyword_database, $.keyword_role, $._grant_name),
    seq($.keyword_role, $._grant_name),
    $.identifier,
  ),

  // --- SHOW extensions for Snowflake ---
  // snowflake_show_target is used directly in _show_statement (index.js) to
  // share the SHOW keyword prefix and avoid parse table explosion.

  // Single token matching all SHOW-able Snowflake plural object types (grammar/object-types.js)
  snowflake_show_target: _ => words_regex(SHOW_TARGETS),

  snowflake_scope_type: _ => words_regex(SCOPE_TYPES),

  // Snowflake SHOW with LIKE and/or IN — placed in snowflake_statement to avoid
  // state explosion from optional_parenthesis wrapping in _dml_read.
  // At least one of LIKE or IN is required to disambiguate from bare
  // SHOW <target> which is handled by _show_statement in _dml_read.
  snowflake_show_statement: $ => prec.left(seq(
    $.keyword_show,
    optional($.keyword_terse),
    $.snowflake_show_target,
    optional(seq($.keyword_root, $.keyword_only)),
    optional($.keyword_history),
    repeat1($._show_clause),
    optional(seq($.keyword_root, $.keyword_only)),
  )),

  _show_clause: $ => choice(
    // LIKE 'pattern'
    seq($.keyword_like, choice($.literal, $.snowflake_variable_reference)),
    // IN [scope] [name]
    seq(
      $.keyword_in,
      optional($._show_scope_type),
      optional($.object_reference),
    ),
    // STARTS WITH 'prefix'
    seq($.keyword_starts, $.keyword_with, $.literal),
    // LIMIT n [FROM 'name']
    seq($.keyword_limit, $.literal, optional(seq($.keyword_from, $.literal))),
    // ON | TO | OF | FOR | BY [type] name[(arg types)]   (SHOW GRANTS ON TABLE t, SHOW GRANTS TO ROLE r, ...)
    seq(
      choice($.keyword_on, $.keyword_to, $.keyword_of, $.keyword_for, $.keyword_by),
      optional(choice($._grant_object_type, $.keyword_role, $.snowflake_scope_type)),
      $.object_reference,
      optional($.function_arguments),
    ),
  ),

  _show_scope_type: $ => choice(
    $.keyword_database,
    $.keyword_schema,
    $.keyword_account,
    $.keyword_table,
    $.keyword_view,
    $.keyword_session,
    $.snowflake_scope_type,
  ),

  // Account keyword for SHOW ... IN ACCOUNT
  keyword_account: _ => /[aA][cC][cC][oO][uU][nN][tT]/,

  // EXECUTE keyword for EXECUTE TASK / EXECUTE IMMEDIATE
  keyword_execute: _ => /[eE][xX][eE][cC][uU][tT][eE]/,
};
