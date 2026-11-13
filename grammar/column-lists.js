import { comma_list, optional_parenthesis, paren_list, wrapped_in_parenthesis } from "./helpers.js";

export default {

  _column_list: $ => paren_list(alias($._column, $.column), true),

  _column: $ => choice(
    $.identifier,
    alias($._literal_string, $.literal),
  ),

  column_definitions: $ => seq(
    '(',
    comma_list($.column_definition, true),
    optional($.constraints),
    ')',
  ),

  column_definition: $ => prec.left(seq(
    field('name', $._column),
    field('type', $._type),
    repeat($._column_constraint),
  )),

  _column_comment: $ => seq(
    $.keyword_comment,
    alias($._literal_string, $.literal)
  ),

  _column_constraint: $ => prec.left(choice(
    // VARCHAR COLLATE 'en-ci'
    seq($.keyword_collate, $._literal_string),
    choice(
      $.keyword_null,
      $._not_null,
    ),
    seq(
      optional(seq($.keyword_foreign, $.keyword_key)),
      $.keyword_references,
      $.object_reference,
      paren_list($.identifier, true),
      repeat(
        seq(
          $.keyword_on,
          choice($.keyword_delete, $.keyword_update),
          choice(
            seq($.keyword_no, $.keyword_action),
            $.keyword_restrict,
            $.keyword_cascade,
            seq(
              $.keyword_set,
              choice($.keyword_null, $.keyword_default),
                optional(paren_list($.identifier, true))
            ),
          ),
        ),
      ),
    ),
    $._default_expression,
    $._primary_key,
    // AUTOINCREMENT | IDENTITY [(start, step) | START n INCREMENT n] [ORDER | NOORDER]
    seq(
      choice($.keyword_autoincrement, $.keyword_identity),
      optional(choice(
        seq('(', $.literal, ',', $.literal, ')'),
        seq($.keyword_start, $.literal, $.keyword_increment, $.literal),
      )),
      optional(choice($.keyword_order, $.keyword_noorder, seq($.keyword_no, $.keyword_order))),
    ),
    $._column_comment,
    // CONSTRAINT name (the constraint itself follows as the next item), CHECK (expr), constraint properties
    seq($.keyword_constraint, $.identifier),
    seq($.keyword_check, wrapped_in_parenthesis($._expression)),
    $.constraint_property,
    // [WITH] PROJECTION POLICY name
    seq(optional($.keyword_with), $.keyword_projection, $.keyword_policy, $.object_reference),
    // [WITH] TAG (name = 'value', ..)
    $.with_tag_clause,
    // Snowflake: [WITH] MASKING POLICY name [USING (col, ..)]
    seq(
      optional($.keyword_with),
      $.keyword_masking,
      $.keyword_policy,
      $.object_reference,
      optional(seq($.keyword_using, paren_list($.identifier, true))),
    ),
    seq(
      optional(seq($.keyword_generated, $.keyword_always)),
      $.keyword_as,
      $._expression,
      optional($.keyword_virtual),
    ),
    $.keyword_unique
  )),

  // [NOT] ENFORCED | [NOT] DEFERRABLE | INITIALLY DEFERRED|IMMEDIATE | ENABLE | DISABLE | VALIDATE | NOVALIDATE | RELY | NORELY
  constraint_property: $ => choice(
    seq(optional($.keyword_not), $.keyword_enforced),
    seq(optional($.keyword_not), $.keyword_deferrable),
    seq($.keyword_initially, choice($.keyword_deferred, $.keyword_immediate)),
    $.keyword_enable,
    $.keyword_disable,
    $.keyword_validate,
    $.keyword_novalidate,
    $.keyword_rely,
    $.keyword_norely,
  ),

  // [WITH] TAG (name = 'value', ..)
  with_tag_clause: $ => seq(
    optional($.keyword_with),
    $.keyword_tag,
    '(',
    comma_list($.tag_assignment, true),
    ')',
  ),

  _default_expression: $ => seq(
    $.keyword_default,
    choice(
      // Prefer ending the default at a plain literal so that a following
      // NOT NULL starts the next constraint instead of a NOT LIKE/NOT IN operator.
      prec(10, $.literal),
      optional_parenthesis($._inner_default_expression),
    ),
  ),
  _inner_default_expression: $ => choice(
      $.literal,
      $.list,
      $.cast,
      $.binary_expression,
      $.unary_expression,
      $.array,
      $.invocation,
      // seq.NEXTVAL
      alias($._qualified_field, $.field),
      prec.left(seq($.keyword_current_timestamp, optional(seq('(', optional($._expression), ')')), optional(seq('::', $._type)))),
      prec.left(seq($.keyword_current_date, optional(seq('(', optional($._expression), ')')), optional(seq('::', $._type)))),
      alias($.implicit_cast, $.cast),
  ),

  constraints: $ => seq(
    ',',
    $.constraint,
    repeat(
      seq(',', $.constraint),
    ),
  ),

  // Snowflake out-of-line constraint, optionally followed by COMMENT '..'
  constraint: $ => seq(
    choice(
      $._constraint_literal,
      $._key_constraint,
      $._primary_key_constraint,
      $.index_definition,
      seq($.keyword_check, wrapped_in_parenthesis($._expression)),
    ),
    repeat($.constraint_property),
    optional($._column_comment),
  ),

  // Snowflake hybrid tables: INDEX name (cols) [INCLUDE (cols)]
  index_definition: $ => seq(
    $.keyword_index,
    $.identifier,
    $.ordered_columns,
    optional(seq($.keyword_include, $.ordered_columns)),
  ),

  _constraint_literal: $ => prec.left(seq(
    $.keyword_constraint,
    field('name', $.identifier),
    choice(
      seq(
        $._primary_key,
        $.ordered_columns,
      ),
      seq(
        $.keyword_unique,
        $.ordered_columns,
      ),
      seq(
        $.keyword_foreign,
        $.keyword_key,
        $.ordered_columns,
        $._references_clause,
      ),
      seq($.keyword_check, wrapped_in_parenthesis($._expression)),
    ),
  )),

  _primary_key_constraint: $ => seq(
    $._primary_key,
    $.ordered_columns,
  ),

  // Out-of-line UNIQUE (cols) and [FOREIGN KEY] (cols) REFERENCES t (cols)
  _key_constraint: $ => choice(
    seq($.keyword_unique, $.ordered_columns),
    seq(
      $.keyword_foreign,
      $.keyword_key,
      $.ordered_columns,
      $._references_clause,
    ),
  ),

  // REFERENCES t (cols) [ON DELETE|UPDATE action ...]
  _references_clause: $ => seq(
    $.keyword_references,
    $.object_reference,
    paren_list($.identifier, true),
    repeat(
      seq(
        $.keyword_on,
        choice($.keyword_delete, $.keyword_update),
        choice(
          seq($.keyword_no, $.keyword_action),
          $.keyword_restrict,
          $.keyword_cascade,
          seq(
            $.keyword_set,
            choice($.keyword_null, $.keyword_default),
            optional(paren_list($.identifier, true))
          ),
        ),
      ),
    ),
  ),

  ordered_columns: $ => paren_list(alias($.ordered_column, $.column), true),

  ordered_column: $ => field('name', $._column),

};
