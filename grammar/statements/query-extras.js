import { comma_list, paren_list, wrapped_in_parenthesis } from "../helpers.js";

// Snowflake query constructs: time travel, CHANGES, PIVOT/UNPIVOT, MATCH_RECOGNIZE,
// RESAMPLE, ASOF JOIN, CONNECT BY, GROUPING SETS, SEMANTIC_VIEW, TOP n.
export default {

  // modifiers that may follow a table reference in FROM
  _relation_modifier: $ => choice(
    $.at_before,
    $.changes_clause,
    $.pivot,
    $.unpivot,
    $.match_recognize,
    $.resample,
  ),

  // AT | BEFORE (TIMESTAMP => ts | OFFSET => n | STATEMENT => id | STREAM => 'name' ...)
  at_before: $ => seq(
    choice($.keyword_at, $.keyword_before),
    '(',
    comma_list($.time_travel_parameter, true),
    ')',
  ),

  time_travel_parameter: $ => seq(
    field('name', choice(
      $.keyword_timestamp,
      $.keyword_offset,
      $.keyword_statement,
      $.keyword_stream,
      $.identifier,
    )),
    '=>',
    field('value', $._expression),
  ),

  // CHANGES (INFORMATION => DEFAULT | APPEND_ONLY) AT (...) [END (...)]
  changes_clause: $ => seq(
    $.keyword_changes,
    '(',
    $.keyword_information,
    '=>',
    choice($.keyword_default, $.keyword_append_only),
    ')',
    $.at_before,
    optional($.change_end),
  ),

  change_end: $ => seq(
    $.keyword_end,
    '(',
    comma_list($.time_travel_parameter, true),
    ')',
  ),

  pivot: $ => seq(
    $.keyword_pivot,
    '(',
    $.invocation,
    optional(seq(optional($.keyword_as), field('alias', $.identifier))),
    $.keyword_for,
    field('column', $.identifier),
    $.keyword_in,
    '(',
    choice(
      comma_list($.pivot_value, true),
      seq($.keyword_any, optional($.order_by)),
      $._dml_read,
    ),
    ')',
    optional(seq($.keyword_default, $.keyword_on, $.keyword_null, wrapped_in_parenthesis($._expression))),
    ')',
  ),

  pivot_value: $ => seq(
    $._expression,
    optional(seq(optional($.keyword_as), field('alias', $.identifier))),
  ),

  unpivot: $ => seq(
    $.keyword_unpivot,
    optional(seq(choice($.keyword_include, $.keyword_exclude), $.keyword_nulls)),
    '(',
    field('value', $.identifier),
    $.keyword_for,
    field('name', $.identifier),
    $.keyword_in,
    paren_list($.pivot_value, true),
    ')',
  ),

  // RESAMPLE (USING col INCREMENT BY n [PARTITION BY ..] [METADATA_COLUMNS f() [AS a], ..])
  resample: $ => seq(
    $.keyword_resample,
    '(',
    $.keyword_using,
    $._expression,
    $.keyword_increment,
    $.keyword_by,
    $._expression,
    optional($.partition_by),
    optional(seq(
      $.keyword_metadata_columns,
      comma_list($.term, true),
    )),
    ')',
  ),

  match_recognize: $ => seq(
    $.keyword_match_recognize,
    '(',
    repeat(choice(
      $.partition_by,
      $.order_by,
      seq($.keyword_measures, comma_list($.measure, true)),
      $.rows_per_match,
      seq($.keyword_after, $.keyword_match, $.keyword_skip, $.skip_target),
    )),
    $.keyword_pattern,
    '(',
    $.match_pattern,
    ')',
    $.keyword_define,
    comma_list($.symbol_definition, true),
    ')',
  ),

  measure: $ => seq(
    optional(choice($.keyword_final, $.keyword_running)),
    $._expression,
    optional($._alias),
  ),

  rows_per_match: $ => choice(
    seq($.keyword_one, $.keyword_row, $.keyword_per, $.keyword_match),
    seq(
      $.keyword_all, $.keyword_rows, $.keyword_per, $.keyword_match,
      optional(choice(
        seq($.keyword_show, $.keyword_empty, $.keyword_matches),
        seq($.keyword_omit, $.keyword_empty, $.keyword_matches),
        seq($.keyword_with, $.keyword_unmatched, $.keyword_rows),
      )),
    ),
  ),

  skip_target: $ => choice(
    seq($.keyword_past, $.keyword_last, $.keyword_row),
    seq($.keyword_to, $.keyword_next, $.keyword_row),
    seq($.keyword_to, optional(choice($.keyword_first, $.keyword_last)), $.identifier),
  ),

  symbol_definition: $ => seq(
    field('symbol', $.identifier),
    $.keyword_as,
    $._expression,
  ),

  // regex-like row pattern: S1 S2*? ( {- S3 -} S4 )+ | PERMUTE(S1, S2){1,2} $
  match_pattern: $ => seq(
    $._pattern_sequence,
    repeat(seq('|', $._pattern_sequence)),
  ),

  _pattern_sequence: $ => repeat1($._pattern_atom),

  _pattern_atom: $ => seq(
    choice(
      alias($.identifier, $.pattern_symbol),
      '^',
      '$',
      seq('(', $.match_pattern, ')'),
      seq('{-', $.match_pattern, '-}'),
      seq($.keyword_permute, paren_list(alias($.identifier, $.pattern_symbol), true)),
    ),
    optional($.pattern_quantifier),
  ),

  pattern_quantifier: _ => token(choice(/[*+?]\??/, /\{(\d+,?\d*|,\d+)\}\??/)),

  // ASOF JOIN t MATCH_CONDITION (l >= r) [ON ..]
  asof_join: $ => seq(
    optional($._join_side),
    $.keyword_asof,
    $.keyword_join,
    choice($.relation, $.lateral_relation),
    $.keyword_match_condition,
    wrapped_in_parenthesis($._expression),
    optional(choice(
      seq($.keyword_on, field('predicate', $._expression)),
      seq($.keyword_using, alias($._column_list, $.list)),
    )),
  ),

  // START WITH p CONNECT BY [PRIOR] a = [PRIOR] b  (in either order)
  hierarchical_query: $ => choice(
    seq($.start_with, $.connect_by),
    seq($.connect_by, optional($.start_with)),
  ),

  start_with: $ => seq($.keyword_start, $.keyword_with, $._expression),

  connect_by: $ => seq($.keyword_connect, $.keyword_by, $._expression),

  prior_expression: $ => prec.left('unary_not', seq($.keyword_prior, $._expression)),

  connect_by_root: $ => prec.left('unary_not', seq($.keyword_connect_by_root, $._expression)),

  grouping_sets: $ => seq(
    choice(
      seq($.keyword_grouping, $.keyword_sets),
      $.keyword_cube,
      $.keyword_rollup,
    ),
    paren_list(choice($._expression), true),
  ),

  // SEMANTIC_VIEW(name METRICS .. DIMENSIONS .. [WHERE ..])
  semantic_view_call: $ => seq(
    $.keyword_semantic_view,
    '(',
    $.object_reference,
    repeat(choice(
      seq($.keyword_metrics, choice(comma_list($.semantic_call_item, true), paren_list($.semantic_call_item, true))),
      seq($.keyword_facts, choice(comma_list($.semantic_call_item, true), paren_list($.semantic_call_item, true))),
      seq($.keyword_dimensions, choice(comma_list($.semantic_call_item, true), paren_list($.semantic_call_item, true))),
    )),
    optional(seq($.keyword_where, $._expression)),
    ')',
  ),

  semantic_call_item: $ => seq($.object_reference, optional($._alias)),

  // CREATE [OR REPLACE] SEMANTIC VIEW name TABLES (..) [RELATIONSHIPS (..)] [FACTS (..)] [DIMENSIONS (..)] [METRICS (..)] [COMMENT = ..]
  create_semantic_view: $ => prec.left(seq(
    $.keyword_create,
    optional(choice($._or_replace, $._or_alter)),
    $.keyword_semantic_view,
    optional($._if_not_exists),
    $.object_reference,
    repeat(choice(
      $.semantic_section,
      $.procedure_comment,
      $.copy_clause,
      $._plain_property,
    )),
  )),

  semantic_section: $ => choice(
    seq($.keyword_tables, '(', comma_list($.semantic_table, true), optional(','), ')'),
    seq($.keyword_relationships, '(', comma_list($.semantic_relationship, true), optional(','), ')'),
    seq(
      choice($.keyword_facts, $.keyword_dimensions, $.keyword_metrics),
      '(', comma_list($.semantic_item, true), optional(','), ')',
    ),
  ),

  // logical table:  t AS db.s.tbl PRIMARY KEY (c) UNIQUE (c) WITH SYNONYMS ('x') COMMENT = '..'
  semantic_table: $ => seq(
    field('name', $.identifier),
    optional($.keyword_as),
    $.object_reference,
    repeat($._semantic_modifier),
  ),

  // relationship:  r AS a (c1, c2) REFERENCES b [(c)]
  semantic_relationship: $ => seq(
    field('name', $.identifier),
    $.keyword_as,
    $.object_reference,
    alias($._column_list, $.list),
    $.keyword_references,
    $.object_reference,
    optional(alias($._column_list, $.list)),
  ),

  // fact / dimension / metric:  [PRIVATE] t.n AS expr [WITH SYNONYMS ('x')] [COMMENT = '..']
  semantic_item: $ => seq(
    optional(choice($.keyword_private, $.keyword_public)),
    field('name', $.object_reference),
    $.keyword_as,
    $._expression,
    repeat($._semantic_modifier),
  ),

  _semantic_modifier: $ => choice(
    seq($.keyword_primary, $.keyword_key, alias($._column_list, $.list)),
    seq($.keyword_unique, alias($._column_list, $.list)),
    seq($.keyword_with, $.keyword_synonyms, optional('='), paren_list(alias($._literal_string, $.literal), true)),
    $.procedure_comment,
  ),

};
