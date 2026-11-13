import { optional_parenthesis, wrapped_in_parenthesis } from "../helpers.js";

export default {

  _merge_statement: $=> seq(
    $.keyword_merge,
    $.keyword_into,
    $.object_reference,
    optional($._alias),
    $.keyword_using,
    choice(
      $.subquery,
      wrapped_in_parenthesis($.values),
      $.object_reference
    ),
    optional(seq(
      $._alias,
      // Optional column list after alias: AS source (col1, col2, ...)
      optional(wrapped_in_parenthesis(commaSep1($.identifier))),
    )),
    $.keyword_on,
    optional_parenthesis(field("predicate", $._expression)),
    repeat1($.when_clause)
  ),

  when_clause: $ => prec.left(seq(
    $.keyword_when,
    optional($.keyword_not),
    $.keyword_matched,
    optional(
      seq(
        $.keyword_and,
        optional_parenthesis(field("predicate", $._expression))
      )
    ),
    $.keyword_then,
    choice(
      $.keyword_delete,
      seq(
        $.keyword_update,
        $._set_values,
      ),
      seq(
        $.keyword_insert,
        $._insert_values
      ),
      // UPDATE ALL BY NAME | INSERT ALL BY NAME
      seq(choice($.keyword_update, $.keyword_insert), $.keyword_all, $.keyword_by, $.keyword_name),
      optional($.where)
    )
  )),

};

function commaSep1(rule) {
  return seq(rule, repeat(seq(',', rule)));
}
