import { paren_list, wrapped_in_parenthesis } from "../helpers.js";

export default {

  // This is only used in create function statement, it is not needed to check
  // the start tag match the end one. The usage of this syntax in other
  // context is done by _dollar_string.
  dollar_quote: () => /\$[^\$]*\$/,

  create_function: $ => prec.left(seq(
    $.keyword_create,
    optional(choice($._or_replace, $._or_alter)),
    optional($.keyword_secure),
    $.keyword_function,
    optional($._if_not_exists),
    $.object_reference,
    $.function_arguments,
    // Snowflake: COPY GRANTS
    optional(seq($.keyword_copy, $.keyword_grants)),
    $.keyword_returns,
    choice(
      $._type,
      seq($.keyword_table, $.column_definitions),
      seq($.keyword_table, '(', ')'),
    ),
    optional($._not_null),
    repeat($._function_option),
    choice(
      // SQL-style function: optional options, then the body.
      seq(
        // ensure that there's only one function body -- other specifiers are
        // less variable but the body can have all manner of conflicting stuff
        $.function_body,
        repeat($._function_option),
      ),
      // Snowflake handler languages (Python, Java, ...): properties such as
      // RUNTIME_VERSION / HANDLER / IMPORTS, and an optional opaque string body.
      seq(
        $.routine_language,
        repeat(choice($._function_option, $.routine_property)),
        optional(seq(
          $.routine_body,
          repeat(choice($._function_option, $.routine_property)),
        )),
      ),
    ),
  )),

  _function_option: $ => choice(
    $.function_language,
    $.function_volatility,
    $.function_strictness,
    $.procedure_comment,
    $.copy_clause,
    // SERVICE = svc ENDPOINT = ep CONTEXT_HEADERS = (..) MAX_BATCH_ROWS = n (service functions)
    $._plain_property,
  ),

  // LANGUAGE for handler-based routines whose body is source code in another
  // language (as opposed to SQL, whose body is parsed as SQL).
  routine_language: $ => seq(
    $.keyword_language,
    choice(
      $.keyword_python,
      $.keyword_java,
      $.keyword_javascript,
      $.keyword_scala,
    ),
  ),

  // NAME = value properties of handler-based routines.
  routine_property: $ => seq(
    field('name', choice(
      $.keyword_runtime_version,
      $.keyword_handler,
      $.keyword_imports,
      $.keyword_packages,
      $.keyword_target_path,
      $.keyword_external_access_integrations,
      $.keyword_secrets,
    )),
    '=',
    field('value', choice(
      $.literal,
      $.routine_property_list,
    )),
  ),

  routine_property_list: $ => paren_list(
    choice(
      alias($._literal_string, $.literal),
      $.routine_secret,
      $.identifier,
    ),
    true,
  ),

  // SECRETS = ('name' = secret_object)
  routine_secret: $ => seq(
    alias($._literal_string, $.literal),
    '=',
    $.object_reference,
  ),

  // Source code body of a handler-based routine: AS '<code>' or AS $$<code>$$
  routine_body: $ => seq(
    $.keyword_as,
    alias($._literal_string, $.literal),
  ),

  function_argument: $ => seq(
    optional(seq(
      $.identifier,
      // Snowflake procedure argument modes: name { IN | INPUT | OUT | OUTPUT } type
      optional(field('mode', choice($.keyword_in, $.keyword_input, $.keyword_out, $.keyword_output))),
    )),
    choice($._type, seq($.keyword_table, paren_list($._type))),
    optional(
      seq(
        $.keyword_default,
        // literal or expression such as CURRENT_DATE, CURRENT_DATE() - 1
        $._expression,
      ),
    ),
  ),

    function_arguments: $ => paren_list(
      $.function_argument,
      false,
    ),

  _function_return: $ => seq(
    $.keyword_return,
    $._expression,
  ),

  function_declaration: $ => seq(
    $.identifier,
    $._type,
    optional(
      seq(
        ':=',
        choice(
          wrapped_in_parenthesis($.statement),
          // TODO are there more possibilities here? We can't use `_expression` since
          // that includes subqueries
          $.literal,
        ),
      ),
    ),
    ';',
  ),

  _function_body_statement: $ => choice(
    $.statement,
    $._function_return,
  ),

  function_body: $ => choice(
    seq(
      $.keyword_as,
      alias($._dollar_quoted_string_start_tag, $.dollar_quote),
      optional(
        seq(
          $.keyword_declare,
          repeat1(
            $.function_declaration,
          ),
        ),
      ),
      $.keyword_begin,
      repeat1(
        seq(
          $._function_body_statement,
          ';',
        ),
      ),
      $.keyword_end,
      optional(';'),
      alias($._dollar_quoted_string_end_tag, $.dollar_quote),
    ),
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
    seq(
      $.keyword_as,
      alias($._dollar_quoted_string_start_tag, $.dollar_quote),
      $._function_body_statement,
      optional(';'),
      alias($._dollar_quoted_string_end_tag, $.dollar_quote),
    ),
    // Snowflake SQL UDF: AS $$ <scalar expression> $$
    seq(
      $.keyword_as,
      alias($._dollar_quoted_string_start_tag, $.dollar_quote),
      $._expression,
      alias($._dollar_quoted_string_end_tag, $.dollar_quote),
    ),
  ),

  function_language: $ => seq(
    $.keyword_language,
    // SQL, JAVASCRIPT, PYTHON, JAVA, SCALA (handler languages are matched by routine_language)
    $.identifier
  ),

  function_volatility: $ => choice(
    $.keyword_immutable,
    $.keyword_volatile,
  ),

  function_strictness: $ => choice(
    seq(
      choice(
        $.keyword_called,
        seq(
          $.keyword_returns,
          $.keyword_null,
        ),
      ),
      $.keyword_on,
      $.keyword_null,
      $.keyword_input,
    ),
    $.keyword_strict,
  ),

};
