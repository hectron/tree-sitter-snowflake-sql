import { comma_list, paren_list, wrapped_in_parenthesis } from "./helpers.js";

// Snowflake expression extras: lambdas, ESCAPE, COLLATE, POSITION(a IN b), PERIOD literals,
// structured OBJECT types, TYPE literals.
export default {

  // x -> x + 1,  (acc INT, v INT) -> acc + v,  a INT -> a * 2
  lambda_expression: $ => prec.right(seq(
    choice(
      $.lambda_parameter,
      paren_list($.lambda_parameter, true),
    ),
    '->',
    field('body', $._expression),
  )),

  lambda_parameter: $ => seq(
    field('name', $.identifier),
    optional(field('type', $._type)),
  ),

  // x LIKE pattern ESCAPE '\\'
  escape_clause: $ => prec.left('pattern_matching', seq(
    field('expression', $._expression),
    $.keyword_escape,
    field('escape', $._literal_string),
  )),

  // expr COLLATE 'en-ci'
  collate_expression: $ => prec.left('binary_other', seq(
    field('expression', $._expression),
    $.keyword_collate,
    field('collation', $._literal_string),
  )),

  // POSITION(needle IN haystack) and POSITION(needle, haystack [, start])
  position_call: $ => seq(
    alias($.keyword_position, $.keyword_position),
    '(',
    choice(
      seq($._position_haystack, $.keyword_in, $._position_haystack),
      seq($._expression, repeat1(seq(',', $._expression))),
    ),
    ')',
  ),

  // right-hand side of POSITION(x IN y): anything that cannot start an IN list or subquery
  _position_haystack: $ => prec(1, choice(
    $.literal,
    alias($._qualified_field, $.field),
    $.invocation,
    $.cast,
    alias($.implicit_cast, $.cast),
    $.variant_access,
    $.snowflake_variable_reference,
  )),

  // OBJECT(name VARCHAR, n NUMBER NOT NULL)
  object_type: $ => seq(
    $.keyword_object,
    '(',
    comma_list($.object_type_field, true),
    ')',
  ),

  object_type_field: $ => seq(
    field('name', $.identifier),
    field('type', $._type),
    optional(seq($.keyword_not, $.keyword_null)),
  ),

  // PERIOD(DATE) '[2024-01-01, 2024-02-01)'
  period_type: $ => seq(
    $.keyword_period,
    '(',
    $._type,
    ')',
  ),

  period_literal: $ => seq($.period_type, $._single_quote_string),

  // TYPE OBJECT(a NUMBER) as an argument value
  type_literal: $ => seq($.keyword_type, $._type),

};
