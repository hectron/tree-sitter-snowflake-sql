import { optional_parenthesis, paren_list, wrapped_in_parenthesis } from "./helpers.js";

export default {

  _expression: $ => prec(1,
    choice(
      $.literal,
      alias(
        $._qualified_field,
        $.field,
      ),
      $.parameter,
      $.list,
      $.case,
      $.window_function,
      $.subquery,
      $.cast,
      $.try_cast,
      alias($.implicit_cast, $.cast),
      $.exists,
      $.invocation,
      $.binary_expression,
      $.subscript,
      $.unary_expression,
      $.array,
      $.interval,
      $.between_expression,
      $.parenthesized_expression,
      $.variant_access,
      $.variant_member,
      $.stage_reference,
      $.snowflake_variable_reference,
      $.snowflake_session_variable,
      $.snowflake_object_literal,
      $.prior_expression,
      $.connect_by_root,
      $.outer_join_column,
      $.escape_clause,
      $.position_call,
      $.collate_expression,
      $.period_literal,
    )
  ),

    object_reference: $ => choice(
      seq(
        field('database', $.identifier),
        '.',
        field('schema', $.identifier),
        '.',
        field('name', $.identifier),
      ),
      seq(
        field('schema', $.identifier),
        '.',
        field('name', $.identifier),
      ),
      field('name', $.identifier),
      // IDENTIFIER(:var) — Snowflake dynamic object reference
      $.snowflake_identifier_ref,
    ),

    field: $ => field('name', $.identifier),

    // Oracle-style outer join marker: t1.c1 = t2.c2(+)
    outer_join_column: $ => seq(alias($._qualified_field, $.field), alias(token(seq('(', /\s*/, '+', /\s*/, ')')), $.outer_join_marker)),

    _qualified_field: $ => choice(
      seq(
        optional(
          seq(
            optional_parenthesis($.object_reference),
            '.',
          ),
        ),
        field('name', $.identifier),
      ),
      // Snowflake staged-file column reference: t.$1
      seq(
        optional_parenthesis($.object_reference),
        '.',
        field('name', alias($._positional_column, $.identifier)),
      ),
    ),

    _positional_column: _ => /\$[0-9]+/,

  parameter: $ => /\?|(\$[0-9]+)/,

  case: $ => seq(
    $.keyword_case,
    choice(
      // simplified CASE x WHEN
      seq(
        $._expression,
        $.keyword_when,
        $._expression,
        $.keyword_then,
        $._expression,
        repeat(
          seq(
            $.keyword_when,
            $._expression,
            $.keyword_then,
            $._expression,
          )
        ),
      ),
      // standard CASE WHEN x, where x must be a predicate
      seq(
        $.keyword_when,
        $._expression,
        $.keyword_then,
        $._expression,
        repeat(
          seq(
            $.keyword_when,
            $._expression,
            $.keyword_then,
            $._expression,
          )
        ),
      ),
    ),
    optional(
      seq(
        $.keyword_else,
        $._expression,
      )
    ),
    $.keyword_end,
  ),

  implicit_cast: $ => seq(
    $._expression,
    '::',
    $._type,
  ),

  cast: $ => seq(
    field('name', $.keyword_cast),
    wrapped_in_parenthesis(
      seq(
        field('parameter', $._expression),
        $.keyword_as,
        $._type,
      ),
    ),
  ),

  try_cast: $ => seq(
    field('name', $.keyword_try_cast),
    wrapped_in_parenthesis(
      seq(
        field('parameter', $._expression),
        $.keyword_as,
        $._type,
      ),
    ),
  ),

  exists: $ => seq(
    $.keyword_exists,
    $.subquery,
  ),

  invocation: $ => prec(1,
    seq(
      $.object_reference,
      // instance method call: instance!METHOD(args)
      optional(seq('!', field('method', $.identifier))),
      choice(
        // default invocation
        paren_list(
          seq(
            optional($.keyword_distinct),
            field(
              'parameter',
              choice(
                $.named_parameter,
                $.lambda_expression,
                $.term,
              ),
            ),
            optional($.order_by)
          )
        ),
        // f(SELECT ..): query argument (data metric functions)
        seq('(', $._select_statement, ')'),
        // EXTRACT(unit FROM expr)
        paren_list(
          seq(
            field(
              'unit',
              $.object_reference,
            ),
            $.keyword_from,
            $.term
          )
        ),
      ),
      // Snowflake: WITHIN GROUP (ORDER BY ...)
      // Used with LISTAGG, PERCENTILE_CONT, etc.
      optional(
        $.within_group,
      ),
    ),
  ),

  named_parameter: $ => seq(
    field('name', $.identifier),
    '=>',
    field('value', choice($._expression, $.type_literal)),
  ),

  within_group: $ => seq(
    $.keyword_within,
    $.keyword_group,
    wrapped_in_parenthesis($.order_by),
  ),

  parenthesized_expression: $ => prec(2,
    wrapped_in_parenthesis($._expression)
  ),

  subscript: $ => prec.left('binary_is',
    seq(
      field('expression', $._expression),
      "[",
      choice(
        field('subscript', $._expression),
        seq(
          field('lower', $._expression),
          ':',
          field('upper', $._expression),
        ),
      ),
      "]",
    ),
  ),

  // member access after an indexed variant path: v:items[0].id
  variant_member: $ => prec.left('binary_is', seq(
    field('expression', choice($.subscript, $.variant_member)),
    '.',
    field('path', $.identifier),
  )),

  // Snowflake semi-structured data access: v:key, v:key.nested, v:key1:key2
  variant_access: $ => prec.left('binary_is',
    seq(
      field('expression', $._expression),
      ':',
      field('path', $.identifier),
      // dotted / indexed continuation: v:a.b.c, v:a[0].b
      repeat(prec.dynamic(1, seq('.', field('path', $.identifier)))),
    ),
  ),

  // Snowflake stage references: @~, @%table, @stage, @stage/path, @db.schema.stage/path
  stage_reference: _ => /@(~|%[A-Za-z_][0-9A-Za-z_]*)(\/[^\s;,)]*)?|@[A-Za-z_][0-9A-Za-z_]*(\.[A-Za-z_][0-9A-Za-z_]*)*(\/[^\s;,)]*)?/,

  // Snowflake operators: || (concatenation), -> (lambda / pipe) and ->> (pipe)
  op_other: $ => token(
    choice(
      '->',
      '->>',
      '||',
    ),
  ),

  binary_expression: $ => choice(
    ...[
      ['+', 'binary_plus'],
      ['-', 'binary_plus'],
      ['*', 'binary_times'],
      ['/', 'binary_times'],
      ['%', 'binary_times'],
      ['=', 'binary_relation'],
      ['<', 'binary_relation'],
      ['<=', 'binary_relation'],
      ['!=', 'binary_relation'],
      ['>=', 'binary_relation'],
      ['>', 'binary_relation'],
      ['<>', 'binary_relation'],
      [$.op_other, 'binary_other'],
      [$.keyword_is, 'binary_is'],
      [$.is_not, 'binary_is'],
      [$.keyword_like, 'pattern_matching'],
      [$.not_like, 'pattern_matching'],
      [$.keyword_rlike, 'pattern_matching'],
      [$.not_rlike, 'pattern_matching'],
      // binary_is precedence disambiguates `(is not distinct from)` from an
      // `is (not distinct from)` with a unary `not`
      [$.distinct_from, 'binary_is'],
      [$.not_distinct_from, 'binary_is'],
    ].map(([operator, precedence]) =>
      prec.left(precedence, seq(
        field('left', $._expression),
        field('operator', operator),
        field('right', $._expression)
      ))
    ),
    ...[
      [$.keyword_and, 'clause_connective'],
      [$.keyword_or, 'clause_disjunctive'],
    ].map(([operator, precedence]) =>
      prec.left(precedence, seq(
        field('left', $._expression),
        field('operator', operator),
        field('right', $._expression)
      ))
    ),
    ...[
      [$.keyword_in, 'binary_in'],
      [$.not_in, 'binary_in'],
    ].map(([operator, precedence]) =>
      prec.left(precedence, seq(
        field('left', $._expression),
        field('operator', operator),
        field('right', choice($.list, $.subquery))
      ))
    ),
  ),

  unary_expression: $ => choice(
    ...[
      [$.keyword_not, 'unary_not'],
      [$.bang, 'unary_not'],
      [$.keyword_any, 'unary_not'],
      [$.keyword_some, 'unary_not'],
      [$.keyword_all, 'unary_not'],
    ].map(([operator, precedence]) =>
      prec.left(precedence, seq(
        field('operator', operator),
        field('operand', $._expression)
      ))
    ),
    // Arithmetic sign: -col, +col (binds tighter than * and /). Signed numeric
    // literals (-1) are already literals, so prefer that reading when both parse.
    ...['-', '+'].map(operator =>
      prec.dynamic(-1, prec.left('unary_sign', seq(
        field('operator', operator),
        field('operand', $._expression)
      )))
    ),
  ),

  // Snowflake interval constant: INTERVAL '1 day'
  interval: $ => seq(
      $.keyword_interval,
      $._literal_string,
  ),

  between_expression: $ => choice(
    ...[
          [$.keyword_between, 'between'],
          [seq($.keyword_not, $.keyword_between), 'between'],
      ].map(([operator, precedence]) =>
              prec.left(precedence, seq(
              field('left', $._expression),
              field('operator', operator),
              field('low', $._expression),
              $.keyword_and,
              field('high', $._expression)
          ))
      ),
  ),

  not_in: $ => seq(
    $.keyword_not,
    $.keyword_in,
  ),

  subquery: $ => wrapped_in_parenthesis(
    $._dml_read
  ),

  list: $ => paren_list($._expression),

  literal: $ => prec(2,
    choice(
      $._integer,
      $._decimal_number,
      $._literal_string,
      $._bit_string,
      $._string_casting,
      $.keyword_true,
      $.keyword_false,
      $.keyword_null,
    ),
  ),
  _double_quote_string: _ => /"[^"]*"/,
  // Snowflake single-quoted string: '' and backslash escapes (no adjacent-literal concatenation)
  _single_quote_string: _ => /'([^'\\]|''|\\.)*'/,

  _literal_string: $ => prec(
    1,
    choice(
      $._single_quote_string,
      $._double_quote_string,
      $._dollar_quoted_string,
    ),
  ),
  _natural_number: _ => /\d+/,
  _integer: $ => prec.dynamic(1, seq(
    optional(choice("-", "+")),
    /(0[xX][0-9A-Fa-f]+(_[0-9A-Fa-f]+)*)|(0[oO][0-7]+(_[0-7]+)*)|(0[bB][01]+(_[01]+)*)|(\d+(_\d+)*(e[+-]?\d+(_\d+)*)?)/
  )),
  _decimal_number: $ => prec.dynamic(1, seq(
    optional(
      choice("-", "+")),
    /((\d+(_\d+)*)?[.]\d+(_\d+)*(e[+-]?\d+(_\d+)*)?)|(\d+(_\d+)*[.](e[+-]?\d+(_\d+)*)?)/
  )),
  // Snowflake hexadecimal binary literal: X'4142'
  _bit_string: _ => /[xX]'([^']|'')*'/,
  // The identifier should be followed by a string (no parenthesis allowed)
  _string_casting: $ => seq($.identifier, $._single_quote_string),

  bang: _ => '!',

  identifier: $ => choice(
    $._identifier,
    $._double_quote_string,
  ),
  // support nordic chars and umlaue
  // Snowflake allows $ in identifiers (e.g. SYSTEM$STREAM_HAS_DATA)
  // Also accepts deploy-time placeholders anywhere in the identifier:
  //   ${NAME}    Flyway / schemachange style, e.g. ${DB}.PUBLIC.T or ${ENV}_STAGE
  //   ${flyway:defaultSchema}  Flyway built-in placeholders (name may contain ':')
  //   {{ name }} simple Jinja variable substitution, e.g. {{health_check_name}}_FAILURE
  // Only bare variables; Jinja blocks/filters ({% %}, {{ x | f }}) are out of scope.
  _identifier: _ => /(\$\{[A-Za-z_][0-9A-Za-z_:]*\}|\{\{ *[A-Za-z_][0-9A-Za-z_]* *\}\}|[A-Za-z_\u00C0-\u017F])([0-9A-Za-z_$\u00C0-\u017F]|\$\{[A-Za-z_][0-9A-Za-z_:]*\}|\{\{ *[A-Za-z_][0-9A-Za-z_]* *\}\})*/,

  // Snowflake session variable set with SET: $name
  snowflake_session_variable: _ => /\$[A-Za-z_][0-9A-Za-z_]*/,

  // Snowflake object literal: { 'key': value, 'key2': value2 }
  // Shorthand for OBJECT_CONSTRUCT('key', value, ...)
  // Keys are always string literals in Snowflake.
  snowflake_object_literal: $ => seq(
    '{',
    choice(
      // {*} or {t.*}: all columns as an object
      $.all_fields,
      optional(seq(
      $.snowflake_object_literal_pair,
      repeat(seq(',', $.snowflake_object_literal_pair)),
      optional(','),
    )),
    ),
    '}',
  ),

  snowflake_object_literal_pair: $ => seq(
    field('key', alias($._literal_string, $.literal)),
    ':',
    field('value', $._expression),
  ),

  // IDENTIFIER(:var) or IDENTIFIER('string') — Snowflake dynamic object reference
  // Converts a string or variable to an object reference at runtime.
  // Used in DDL positions: DROP STREAM IF EXISTS IDENTIFIER(:stream_name)
  snowflake_identifier_ref: $ => seq(
    $.keyword_identifier,
    '(',
    choice($.snowflake_variable_reference, $._expression),
    ')',
  ),

};
