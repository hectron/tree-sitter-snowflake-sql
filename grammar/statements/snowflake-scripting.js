// Snowflake Scripting — procedural SQL support
// Covers: DECLARE, LET, assignment, IF/ELSEIF/ELSE, FOR, WHILE, LOOP, REPEAT,
// CASE (statement-level), BREAK/EXIT, CONTINUE/ITERATE, RETURN, RAISE,
// EXCEPTION handling, OPEN/FETCH/CLOSE cursors, and scripting blocks.
//
// Reference: docs/snowflake-scripting-syntax.md (authoritative local copy)
// Source: https://docs.snowflake.com/en/developer-guide/snowflake-scripting/

export default {

  // =========================================================================
  // Scripting block: [DECLARE ...] BEGIN ... [EXCEPTION ...] END
  // =========================================================================
  snowflake_scripting_block: $ => seq(
    optional($.declare_section),
    $.keyword_begin,
    optional(';'),
    repeat(seq($._scripting_statement, ';')),
    optional($.exception_clause),
    $.keyword_end,
  ),

  // =========================================================================
  // DECLARE section
  // =========================================================================
  declare_section: $ => seq(
    $.keyword_declare,
    repeat1($._snowflake_declaration),
  ),

  _snowflake_declaration: $ => choice(
    $.snowflake_declare_variable,
    $.snowflake_declare_cursor,
    $.snowflake_declare_resultset,
    $.snowflake_declare_exception,
  ),

  // Variable: name [TYPE] [{DEFAULT | :=} expr] ;
  snowflake_declare_variable: $ => seq(
    field('name', $.identifier),
    field('type', $._type),
    optional(
      seq(
        choice($.keyword_default, ':='),
        field('default', $._expression),
      ),
    ),
    ';',
  ),

  // CURSOR: name CURSOR FOR {query | resultset_name} ;
  snowflake_declare_cursor: $ => seq(
    field('name', $.identifier),
    $.keyword_cursor,
    $.keyword_for,
    field('source', choice(
      $.identifier,
      $.object_reference,
      $._dml_read,
    )),
    ';',
  ),

  // RESULTSET: name RESULTSET [{DEFAULT | :=} [ASYNC] (query)] ;
  snowflake_declare_resultset: $ => seq(
    field('name', $.identifier),
    $.keyword_resultset,
    optional(
      seq(
        choice($.keyword_default, ':='),
        optional($.keyword_async),
        '(',
        field('default', $._dml_read),
        ')',
      ),
    ),
    ';',
  ),

  // Exception: name EXCEPTION [(-number, 'message')] ;
  snowflake_declare_exception: $ => seq(
    field('name', $.identifier),
    $.keyword_exception,
    optional(
      seq(
        '(',
        field('error_number', $._expression),
        ',',
        field('error_message', $._expression),
        ')',
      ),
    ),
    ';',
  ),

  // =========================================================================
  // Scripting statements — any statement valid inside a scripting block
  // =========================================================================
  _scripting_statement: $ => choice(
    $.statement,
    $.let_statement,
    $.assignment_statement,
    $.if_statement,
    $.for_statement,
    $.while_do_statement,
    $.loop_statement,
    $.repeat_statement,
    $.case_statement,
    $.return_statement,
    $.null_statement,
    $.raise_statement,
    $.break_statement,
    $.continue_statement,
    $.await_statement,
    $.open_statement,
    $.fetch_statement,
    $.close_statement,
    $.snowflake_scripting_block,
    $.scripting_transaction,
    $.begin_transaction_statement,
    $.commit_statement,
    $.rollback_statement,
    $.async_statement,
    prec(-1, alias($.invocation, $.bare_call_statement)),  // bare function calls without CALL keyword
  ),

  // =========================================================================
  // LET statement
  // =========================================================================

  // LET var [TYPE] {DEFAULT | :=} expr ;
  // LET var RESULTSET {:= | DEFAULT} [ASYNC] (query) ;
  // LET var CURSOR FOR {query | resultset_name} ;
  let_statement: $ => seq(
    $.keyword_let,
    field('name', $.identifier),
    choice(
      // LET var CURSOR FOR {query | resultset_name}
      seq(
        $.keyword_cursor,
        $.keyword_for,
        field('source', choice($.identifier, $.object_reference, $._dml_read)),
      ),
      // LET var RESULTSET {:= | DEFAULT} [ASYNC] (query)
      seq(
        $.keyword_resultset,
        choice(':=', $.keyword_default),
        optional($.keyword_async),
        '(',
        field('value', $._dml_read),
        ')',
      ),
      // LET var [TYPE] [{DEFAULT | :=} expr]
      // Type or initialization (or both) must be present
      choice(
        // With type: LET var TYPE [{DEFAULT | :=} expr]
        seq(
          field('type', $._type),
          optional(choice(
            seq($.keyword_default, field('value', $._scripting_value)),
            seq(':=', field('value', $._scripting_value)),
          )),
        ),
        // Without type: LET var {DEFAULT | :=} expr (init required)
        seq(
          choice(
            seq($.keyword_default, field('value', $._scripting_value)),
            seq(':=', field('value', $._scripting_value)),
          ),
        ),
      ),
    ),
  ),

  // =========================================================================
  // Assignment: var := expr ;
  // For RESULTSETs: var := [ASYNC] (query) ;
  // =========================================================================
  assignment_statement: $ => prec.left(seq(
    optional($.keyword_set),
    field('name', $.identifier),
    ':=',
    field('value', $._scripting_value),
  )),

  // A value in LET / assignment: an expression, or the result of a
  // parenthesized EXECUTE IMMEDIATE / CALL: (EXECUTE IMMEDIATE :sql), (CALL proc(...))
  _scripting_value: $ => choice(
    $._expression,
    seq(optional($.keyword_async), '(', choice($.execute_statement, $.call_statement), ')'),
    // LET rs RESULTSET := ASYNC (SELECT ...)
    seq($.keyword_async, $.subquery),
  ),

  // =========================================================================
  // IF / ELSEIF / ELSE / END IF
  // =========================================================================
  if_statement: $ => seq(
    $.keyword_if,
    '(',
    field('condition', $._expression),
    ')',
    $.keyword_then,
    repeat(seq($._scripting_statement, ';')),
    repeat($.elseif_clause),
    optional($.else_clause),
    $.keyword_end,
    $.keyword_if,
  ),

  elseif_clause: $ => seq(
    $.keyword_elseif,
    '(',
    field('condition', $._expression),
    ')',
    $.keyword_then,
    repeat(seq($._scripting_statement, ';')),
  ),

  else_clause: $ => seq(
    $.keyword_else,
    repeat(seq($._scripting_statement, ';')),
  ),

  // =========================================================================
  // FOR statement
  // =========================================================================

  // Cursor-based: FOR var IN cursor DO ... END FOR [label] ;
  // Counter-based: FOR var IN [REVERSE] start TO end {DO|LOOP} ... END {FOR|LOOP} [label] ;
  for_statement: $ => seq(
    $.keyword_for,
    field('iterator', $.identifier),
    $.keyword_in,
    choice(
      // Counter-based: [REVERSE] start TO end {DO|LOOP} ... END {FOR|LOOP}
      seq(
        optional($.keyword_reverse),
        field('start', $._expression),
        $.keyword_to,
        field('end', $._expression),
        choice(
          seq($.keyword_do, repeat(seq($._scripting_statement, ';')), $.keyword_end, $.keyword_for),
          seq($.keyword_loop, repeat(seq($._scripting_statement, ';')), $.keyword_end, $.keyword_loop),
        ),
      ),
      // Cursor-based: cursor DO ... END FOR
      seq(
        field('source', choice($.identifier, $.object_reference)),
        $.keyword_do,
        repeat(seq($._scripting_statement, ';')),
        $.keyword_end,
        $.keyword_for,
      ),
    ),
    // Optional trailing label
    optional(field('label', $.identifier)),
  ),

  // =========================================================================
  // WHILE ... {DO|LOOP} ... END {WHILE|LOOP}
  // =========================================================================
  while_do_statement: $ => seq(
    $.keyword_while,
    '(',
    field('condition', $._expression),
    ')',
    choice(
      seq($.keyword_do, repeat(seq($._scripting_statement, ';')), $.keyword_end, $.keyword_while),
      seq($.keyword_loop, repeat(seq($._scripting_statement, ';')), $.keyword_end, $.keyword_loop),
    ),
    optional(field('label', $.identifier)),
  ),

  // =========================================================================
  // LOOP ... END LOOP
  // =========================================================================
  loop_statement: $ => seq(
    $.keyword_loop,
    repeat(seq($._scripting_statement, ';')),
    $.keyword_end,
    $.keyword_loop,
    optional(field('label', $.identifier)),
  ),

  // =========================================================================
  // REPEAT ... UNTIL (condition) END REPEAT
  // =========================================================================
  repeat_statement: $ => seq(
    $.keyword_repeat,
    repeat(seq($._scripting_statement, ';')),
    $.keyword_until,
    '(',
    field('condition', $._expression),
    ')',
    $.keyword_end,
    $.keyword_repeat,
    optional(field('label', $.identifier)),
  ),

  // =========================================================================
  // CASE statement (scripting-level, different from expression-level CASE)
  // =========================================================================

  // Simple:   CASE (expr) WHEN val THEN stmt; ... [ELSE stmt; ...] END [CASE] ;
  // Searched: CASE WHEN bool THEN stmt; ... [ELSE stmt; ...] END [CASE] ;
  case_statement: $ => seq(
    $.keyword_case,
    // Simple CASE has an operand expression (parentheses optional); searched does not
    optional(field('operand', $._expression)),
    repeat1($.case_statement_when_clause),
    optional($.case_statement_else_clause),
    $.keyword_end,
    optional($.keyword_case),
  ),

  case_statement_when_clause: $ => seq(
    $.keyword_when,
    field('condition', $._expression),
    $.keyword_then,
    repeat1(seq($._scripting_statement, ';')),
  ),

  case_statement_else_clause: $ => seq(
    $.keyword_else,
    repeat1(seq($._scripting_statement, ';')),
  ),

  // =========================================================================
  // BREAK / EXIT [label]
  // =========================================================================
  // AWAIT ALL | AWAIT resultset_name
  await_statement: $ => seq($.keyword_await, choice($.keyword_all, $.identifier)),

  // NULL; (no-op)
  null_statement: $ => $.keyword_null,

  break_statement: $ => seq(
    choice($.keyword_break, $.keyword_exit),
    optional(field('label', $.identifier)),
  ),

  // =========================================================================
  // CONTINUE / ITERATE [label]
  // =========================================================================
  continue_statement: $ => seq(
    choice($.keyword_continue, $.keyword_iterate),
    optional(field('label', $.identifier)),
  ),

  // =========================================================================
  // RETURN [expr]
  // =========================================================================
  return_statement: $ => seq(
    $.keyword_return,
    optional(field('value', $._expression)),
  ),

  // =========================================================================
  // RAISE [exception_name]
  // =========================================================================
  raise_statement: $ => seq(
    $.keyword_raise,
    optional(field('exception', $.identifier)),
  ),

  // =========================================================================
  // OPEN cursor [USING (var, ...)]
  // =========================================================================
  open_statement: $ => seq(
    $.keyword_open,
    field('cursor', $.identifier),
    optional(
      seq(
        $.keyword_using,
        '(',
        field('bind_variables', commaSep1($.identifier)),
        ')',
      ),
    ),
  ),

  // =========================================================================
  // FETCH cursor INTO var [, var ...]
  // =========================================================================
  fetch_statement: $ => seq(
    $.keyword_fetch,
    field('cursor', $.identifier),
    $.keyword_into,
    field('variables', commaSep1($.identifier)),
  ),

  // =========================================================================
  // CLOSE cursor
  // =========================================================================
  close_statement: $ => seq(
    $.keyword_close,
    field('cursor', $.identifier),
  ),

  // =========================================================================
  // EXCEPTION clause
  // EXCEPTION
  //   WHEN name [OR name ...] [{EXIT|CONTINUE}] THEN stmt; ...
  //   [WHEN OTHER [{EXIT|CONTINUE}] THEN stmt; ...]
  // =========================================================================
  exception_clause: $ => seq(
    $.keyword_exception,
    repeat1($.exception_when_clause),
  ),

  exception_when_clause: $ => seq(
    $.keyword_when,
    field('exception', choice(
      // Named exception(s): name [OR name ...]
      seq($.identifier, repeat(seq($.keyword_or, $.identifier))),
      // WHEN OTHER
      $.keyword_other,
    )),
    // Optional EXIT or CONTINUE qualifier
    optional(choice($.keyword_exit, $.keyword_continue)),
    $.keyword_then,
    repeat(seq($._scripting_statement, ';')),
  ),

  // =========================================================================
  // ASYNC (statement) — asynchronous statement execution in scripting blocks
  // Wraps a full SQL statement for async execution.
  // Example: ASYNC (DROP TASK IF EXISTS IDENTIFIER(:task_name))
  // =========================================================================
  async_statement: $ => seq(
    $.keyword_async,
    '(',
    $.statement,
    ')',
  ),

  // =========================================================================
  // Transaction inside scripting block
  // BEGIN TRANSACTION; ... COMMIT|ROLLBACK;
  // Separate from top-level `transaction` because inside scripting blocks,
  // BEGIN TRANSACTION is required (not bare BEGIN).
  // =========================================================================
  scripting_transaction: $ => seq(
    choice($.keyword_begin, $.keyword_start),
    $.keyword_transaction,
    optional(';'),
    repeat(seq($._scripting_statement, ';')),
    choice(
      seq($.keyword_commit, optional($.keyword_transaction)),
      seq($.keyword_rollback, optional($.keyword_transaction)),
    ),
  ),

  // =========================================================================
  // Snowflake variable reference: :variable
  // Used in SQL contexts within scripting blocks.
  // Leading colon with no preceding expression distinguishes from
  // variant_access (expr:key) and implicit_cast (expr::type).
  // =========================================================================
  snowflake_variable_reference: _ => /:[A-Za-z_\u00C0-\u017F][0-9A-Za-z_$\u00C0-\u017F]*/,

};

// =========================================================================
// Helper: comma-separated list with at least one element
// =========================================================================
function commaSep1(rule) {
  return seq(rule, repeat(seq(',', rule)));
}


