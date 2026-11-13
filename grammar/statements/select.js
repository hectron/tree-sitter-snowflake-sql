import { comma_list, optional_parenthesis, paren_list, wrapped_in_parenthesis } from "../helpers.js";

export default {

  _cte: $ => seq(
      $.keyword_with,
      optional($.keyword_recursive),
      $.cte,
      repeat(
          seq(
            ',',
            $.cte,
          ),
      ),
  ),

  cte: $ => seq(
    $.identifier,
    optional(paren_list(field("argument", $.identifier))),
    $.keyword_as,
    wrapped_in_parenthesis(
      alias($._dml_read, $.statement),
    ),
  ),

  set_operation: $ => seq(
    $._select_statement,
    repeat1(
      seq(
        field(
          "operation",
          choice(
            seq($.keyword_union, optional($.keyword_all)),
            $.keyword_except,
            $.keyword_intersect,
          ),
        ),
        $._select_statement,
      ),
    ),
  ),

  _select_statement: $ => choice(
    $._select_body,
    seq('(', $._select_body, ')'),
  ),

  _select_body: $ => prec.right(
    seq(
      $.select,
      optional(
        seq(
          $.keyword_into,
          $.select_expression,
        ),
      ),
      optional($.from),
      optional($.where),
      optional($.hierarchical_query),
      optional($.group_by),
      optional($.having),
      optional($.qualify),
      optional($.window_clause),
      optional($.order_by),
      optional($.limit),
      optional(seq($.keyword_for, $.keyword_update)),
    ),
  ),

  select: $ => seq(
    $.keyword_select,
    seq(
      optional($.keyword_distinct),
      optional(seq($.keyword_top, $.literal)),
      $.select_expression,
    ),
  ),

  select_expression: $ => seq(
    $.term,
    repeat(
      seq(
        ',',
        $.term,
      ),
    ),
    // Snowflake allows a trailing comma before FROM
    optional(','),
  ),

  term: $ => seq(
    field(
      'value',
      choice(
        $.all_fields,
        // f((*)) / f((t.*)): wildcard in parentheses
        alias(wrapped_in_parenthesis($.all_fields), $.list),
        $._expression,
      ),
    ),
    optional($._alias),
  ),

  all_fields: $ => prec.right(seq(
    optional(
      seq(
        $.object_reference,
        '.',
      ),
    ),
    '*',
    // Snowflake: SELECT * ILIKE 'pattern' EXCLUDE (a, b) REPLACE (expr AS c) RENAME (a AS b)
    // EXCLUDE and RENAME take a single bare item or a parenthesized list.
    optional(seq($.keyword_like, $._literal_string)),
    repeat(choice(
      seq($.keyword_exclude, choice(paren_list($.identifier, true), $.identifier)),
      seq($.keyword_replace, choice(paren_list($._star_replacement, true), $._star_replacement)),
      seq($.keyword_rename, choice(paren_list($._star_rename, true), $._star_rename)),
    )),
  )),

  _star_replacement: $ => seq($._expression, $.keyword_as, $.identifier),
  _star_rename: $ => seq($.identifier, $.keyword_as, $.identifier),

  partition_by: $ => seq(
      $.keyword_partition,
      $.keyword_by,
      comma_list($._expression, true),
  ),

  frame_definition: $ => seq(
      choice(
        seq(
          $.keyword_unbounded,
          $.keyword_preceding,
        ),
        seq(
            field("start",
              choice(
                $.identifier,
                $.binary_expression,
                alias($._literal_string, $.literal),
                alias($._integer, $.literal)
              )
            ),
            $.keyword_preceding,
        ),
        $._current_row,
        seq(
            field("end",
              choice(
                $.identifier,
                $.binary_expression,
                alias($._literal_string, $.literal),
                alias($._integer, $.literal)
              )
            ),
            $.keyword_following,
        ),
        seq(
          $.keyword_unbounded,
          $.keyword_following,
        ),
      ),
  ),

  window_frame: $ => seq(
      choice(
          $.keyword_range,
          $.keyword_rows,
      ),

      choice(
          seq(
              $.keyword_between,
              $.frame_definition,
              optional(
                seq(
                  $.keyword_and,
                  $.frame_definition,
                )
              )
          ),
          seq(
              $.frame_definition,
          )
      ),
  ),

  window_clause: $ => seq(
      $.keyword_window,
      $.identifier,
      $.keyword_as,
      $.window_specification,
  ),

  window_specification: $ => wrapped_in_parenthesis(
    seq(
      optional($.partition_by),
      optional($.order_by),
      optional($.window_frame),
    ),
  ),

  window_function: $ => seq(
      $.invocation,
      optional(choice($.keyword_from_first, $.keyword_from_last)),
      optional(seq(choice($.keyword_ignore, $.keyword_respect), $.keyword_nulls)),
      $.keyword_over,
      choice(
          $.identifier,
          $.window_specification,
      ),
  ),

  _alias: $ => seq(
    optional($.keyword_as),
    field('alias', $.identifier),
  ),

  from: $ => seq(
    $.keyword_from,
    choice($.relation, $.lateral_relation),
    repeat(
      choice(
        // comma-separated relations, possibly mixed with joins:
        // FROM a, b JOIN c ON x, LATERAL FLATTEN(..)
        seq(',', choice($.relation, $.lateral_relation)),
        $.join,
        $.asof_join,
        $.cross_join,
        $.lateral_join,
        $.lateral_cross_join,
      ),
    ),
  ),

  relation: $ => prec.right(
    seq(
      choice(
        $.subquery,
        $.invocation,
        $.object_reference,
        // @stage (FILE_FORMAT => 'f', PATTERN => 'p')
        seq($.stage_reference, optional($.stage_arguments)),
        wrapped_in_parenthesis($.values),
        $.values,
        $.semantic_view_call,
        // $1: result of the previous statement (SHOW .. ->> SELECT .. FROM $1)
        $.parameter,
        wrapped_in_parenthesis(seq($.relation, repeat1(choice($.join, $.cross_join)))),
        wrapped_in_parenthesis(seq($.values, optional($._relation_alias))),
      ),
      optional(choice(
        seq(repeat1($._relation_modifier), optional($._relation_alias)),
        $._relation_alias,
      )),
      optional($.table_sample),
    ),
  ),

  // AT and BEFORE are time-travel keywords but remain usable as table aliases
  _relation_alias: $ => seq(
    optional($.keyword_as),
    field('alias', choice($.identifier, alias($.keyword_at, $.identifier), alias($.keyword_before, $.identifier))),
    optional(alias($._column_list, $.list)),
    repeat($._relation_modifier),
  ),

  stage_arguments: $ => paren_list($.named_parameter, true),

  // Snowflake: SAMPLE | TABLESAMPLE [method] (probability | n ROWS) [REPEATABLE | SEED (n)]
  table_sample: $ => seq(
    choice($.keyword_sample, $.keyword_tablesample),
    optional(choice($.keyword_bernoulli, $.keyword_row, $.keyword_system, $.keyword_block)),
    '(',
    $.literal,
    optional($.keyword_rows),
    ')',
    optional(seq(choice($.keyword_repeatable, $.keyword_seed), '(', $.literal, ')')),
  ),

  // Snowflake: LATERAL FLATTEN(...) or LATERAL subquery in comma-separated FROM
  lateral_relation: $ => prec.right(
    seq(
      $.keyword_lateral,
      choice($.invocation, $.subquery),
      optional(
        seq(
          $._alias,
          optional(alias($._column_list, $.list)),
        ),
      ),
    ),
  ),

  values: $ => prec.right(seq(
    $.keyword_values,
    $.list,
    repeat(
      seq(
        ',',
        $.list,
      ),
    ),
  )),

  join: $ => seq(
    optional($.keyword_natural),
    optional($._join_side),
    optional($.keyword_directed),
    $.keyword_join,
    $.relation,
    optional($.join),
    optional(choice(
      seq(
        $.keyword_on,
        field("predicate", $._expression),
      ),
      seq(
        $.keyword_using,
        alias($._column_list, $.list),
      )
    )),
    optional(seq(choice($.keyword_first, $.keyword_last), wrapped_in_parenthesis($.identifier))),
  ),

  // INNER | {LEFT | RIGHT | FULL} [OUTER]
  _join_side: $ => choice(
    $.keyword_inner,
    seq(choice($.keyword_left, $.keyword_right, $.keyword_full), optional($.keyword_outer)),
  ),

  cross_join: $ => prec.right(
    seq(
      $.keyword_cross,
      optional($.keyword_directed),
      $.keyword_join,
      $.relation,
    )
  ),

  lateral_join: $ => seq(
    optional($._join_side),
    $.keyword_join,
    $.keyword_lateral,
    choice(
      $.invocation,
      $.subquery,
    ),
    optional(
      choice(
        seq(
          $.keyword_as,
          field('alias', $.identifier),
        ),
        field('alias', $.identifier),
      ),
    ),
    // Snowflake: JOIN LATERAL FLATTEN(..) takes no ON clause
    optional(seq(
      $.keyword_on,
      choice(
        $._expression,
        $.keyword_true,
        $.keyword_false,
      ),
    )),
  ),

  lateral_cross_join: $ => seq(
    $.keyword_cross,
    $.keyword_join,
    $.keyword_lateral,
    choice(
      $.invocation,
      $.subquery,
    ),
    optional(
      choice(
        seq(
          $.keyword_as,
          field('alias', $.identifier),
        ),
        field('alias', $.identifier),
      ),
    ),
  ),

  where: $ => seq(
    $.keyword_where,
    field("predicate", $._expression),
  ),

  group_by: $ => prec.left(1, seq(
    $.keyword_group,
    $.keyword_by,
    choice(
      $.keyword_all,
      comma_list(choice($._expression, $.grouping_sets), true),
    ),
  )),

  having: $ => seq(
    $.keyword_having,
    $._expression,
  ),

  qualify: $ => seq(
    $.keyword_qualify,
    $._expression,
  ),

  order_by: $ => prec.right(seq(
    $.keyword_order,
    $.keyword_by,
    choice(
      seq($.keyword_all, optional($.direction), optional(seq($.keyword_nulls, choice($.keyword_first, $.keyword_last)))),
      comma_list($.order_target, true),
    ),
  )),

  order_target: $ => seq(
    $._expression,
    optional($.direction),
    optional(
      seq(
        $.keyword_nulls,
        choice(
          $.keyword_first,
          $.keyword_last,
        ),
      ),
    ),
  ),

  limit: $ => seq(
    $.keyword_limit,
    choice($.literal, $.snowflake_variable_reference),
    optional($.offset),
  ),

  offset: $ => seq(
    $.keyword_offset,
    choice($.literal, $.snowflake_variable_reference),
  ),

};
