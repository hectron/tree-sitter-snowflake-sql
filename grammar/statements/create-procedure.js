export default {

  create_procedure: $ => seq(
    $.keyword_create,
    optional(choice($._or_replace, $._or_alter)),
    $.keyword_procedure,
    optional($._if_not_exists),
    $.object_reference,
    optional($.function_arguments),
    $._procedure_definition,
  ),

  // WITH name AS PROCEDURE (args) RETURNS .. AS <body> CALL name(..)
  call_with_procedure: $ => seq(
    $.keyword_with,
    $.identifier,
    $.keyword_as,
    $.keyword_procedure,
    optional($.function_arguments),
    $._procedure_definition,
    $.call_statement,
  ),

  _procedure_definition: $ => seq(
    // options (COPY GRANTS, LANGUAGE, ..) may precede RETURNS
    repeat($._procedure_option),
    // Snowflake: RETURNS type [NOT NULL]
    optional(seq($.procedure_returns, repeat($._procedure_option))),
    choice(
      // SQL / Snowflake Scripting procedure
      seq(
        $.procedure_body,
        repeat($._procedure_option),
      ),
      // Handler languages (Python, Java, ...): properties and a string body
      seq(
        $.routine_language,
        repeat(choice($._procedure_option, $.routine_property)),
        optional(seq(
          $.routine_body,
          repeat(choice($._procedure_option, $.routine_property)),
        )),
      ),
    ),
  ),

  _procedure_option: $ => choice(
    $.function_language,
    $.procedure_execute_as,
    $.procedure_comment,
    $.function_strictness,
    $.function_volatility,
    $.copy_clause,
  ),

  // Snowflake: RETURNS type [NOT NULL] | RETURNS TABLE (col type, ...)
  procedure_returns: $ => seq(
    $.keyword_returns,
    choice(
      // Scalar return: RETURNS type [NOT NULL]
      seq($._type, optional($._not_null)),
      // Table return: RETURNS TABLE (col type, ...)
      seq(
        $.keyword_table,
        '(',
        optional(
          seq(
            $.procedure_returns_column,
            repeat(seq(',', $.procedure_returns_column)),
          ),
        ),
        ')',
      ),
    ),
  ),

  procedure_returns_column: $ => seq(
    field('name', $.identifier),
    field('type', $._type),
  ),

  // Snowflake: EXECUTE AS {CALLER | OWNER | RESTRICTED CALLER}
  procedure_execute_as: $ => seq(
    $.keyword_execute,
    $.keyword_as,
    choice(
      seq($.keyword_restricted, $.keyword_caller),
      $.keyword_caller,
      $.keyword_owner,
    ),
  ),

  // Snowflake: COMMENT = 'string'
  procedure_comment: $ => seq(
    $.keyword_comment,
    '=',
    alias($._literal_string, $.literal),
  ),

  procedure_body: $ => choice(
    // Dollar-quoted Snowflake scripting block
    seq(
      $.keyword_as,
      alias($._dollar_quoted_string_start_tag, $.dollar_quote),
      $.snowflake_scripting_block,
      optional(';'),
      alias($._dollar_quoted_string_end_tag, $.dollar_quote),
    ),
    // Dollar-quoted single/multiple statements (no BEGIN/END wrapper)
    seq(
      $.keyword_as,
      alias($._dollar_quoted_string_start_tag, $.dollar_quote),
      repeat1(seq($._function_body_statement, ';')),
      alias($._dollar_quoted_string_end_tag, $.dollar_quote),
    ),
    // String literal body
    seq(
      $.keyword_as,
      alias(
        choice(
          $._single_quote_string,
          $._double_quote_string,
        ),
        $.literal
      ),
    ),
    // Snowflake scripting block without dollar quoting: AS [DECLARE...] BEGIN...END
    seq(
      $.keyword_as,
      $.snowflake_scripting_block,
    ),
  ),

};
