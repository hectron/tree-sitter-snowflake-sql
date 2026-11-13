import { comma_list } from "../helpers.js";

export default {

  _insert_statement: $ => $.insert,

  // Snowflake: INSERT [OVERWRITE] INTO t [(cols)] { VALUES (..), .. | query }
  insert: $ => seq(
    $.keyword_insert,
    optional($.keyword_overwrite),
    $.keyword_into,
    $.object_reference,
    $._insert_values,
  ),

  // Snowflake multi-table insert:
  // INSERT [OVERWRITE] {ALL | FIRST} { WHEN cond THEN into_clause+ }... [ELSE into_clause] query
  multi_table_insert: $ => seq(
    $.keyword_insert,
    optional($.keyword_overwrite),
    choice($.keyword_all, $.keyword_first),
    choice(
      seq(repeat1($.multi_insert_when), optional($.multi_insert_else)),
      repeat1($.multi_insert_into),
    ),
    $._dml_read,
  ),

  multi_insert_when: $ => seq(
    $.keyword_when,
    field('condition', $._expression),
    $.keyword_then,
    repeat1($.multi_insert_into),
  ),

  multi_insert_else: $ => seq(
    $.keyword_else,
    repeat1($.multi_insert_into),
  ),

  // INTO table [(columns)] [VALUES (exprs)]
  multi_insert_into: $ => seq(
    $.keyword_into,
    $.object_reference,
    optional(alias($._column_list, $.list)),
    optional(prec.dynamic(1, seq($.keyword_values, $.list))),
  ),

  assignment: $ => seq(
    field('left',
      alias(
        $._qualified_field,
        $.field,
      ),
    ),
    '=',
    field('right', $._expression),
  ),

  _insert_values: $ => seq(
    optional(alias($._column_list, $.list)),
    choice(
      seq(
        $.keyword_values,
        comma_list($.list, true),
      ),
      $._dml_read,
    ),
  ),

  _set_values: $ => seq(
    $.keyword_set,
    comma_list($.assignment, true),
  ),

}
