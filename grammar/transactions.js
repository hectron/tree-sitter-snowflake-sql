export default {

  transaction: $ => seq(
    choice($.keyword_begin, $.keyword_start),
    // TRANSACTION keyword is required to disambiguate from scripting blocks.
    // Inside `program`, bare BEGIN; is handled by begin_transaction_statement.
    $.keyword_transaction,
    optional($.keyword_work),
    optional(seq($.keyword_name, $.identifier)),
    optional(';'),
    repeat(
      seq(
        $.statement,
        ';'
      ),
    ),
    choice(
      $._commit,
      $._rollback,
    ),
  ),

  _commit: $ => seq(
    $.keyword_commit,
    optional(
      $.keyword_transaction,
    ),
  ),

  _rollback: $ => seq(
    $.keyword_rollback,
    optional(
      $.keyword_transaction,
    ),
  ),

  // Standalone COMMIT; at top level or in scripting blocks
  commit_statement: $ => seq(
    $.keyword_commit,
    optional(choice($.keyword_transaction, $.keyword_work)),
    optional(seq($.keyword_name, $.identifier)),
  ),

  // Standalone ROLLBACK; at top level or in scripting blocks
  rollback_statement: $ => seq(
    $.keyword_rollback,
    optional(choice($.keyword_transaction, $.keyword_work)),
  ),

  // Standalone BEGIN; or BEGIN TRANSACTION; or BEGIN WORK; at top level
  // (not inside scripting blocks where BEGIN starts a scripting_block)
  begin_transaction_statement: $ => seq(
    choice($.keyword_begin, $.keyword_start),
    optional(choice($.keyword_transaction, $.keyword_work)),
    optional(seq($.keyword_name, $.identifier)),
  ),

};
