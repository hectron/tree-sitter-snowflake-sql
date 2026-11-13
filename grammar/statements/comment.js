export default {

  comment_statement: $ => seq(
    $.keyword_comment,
    $.keyword_on,
    $._comment_target,
    $.keyword_is,
    alias($._literal_string, $.literal),
  ),

  _comment_target: $ => choice(
    seq($.keyword_column, alias($._qualified_field, $.object_reference)),
    seq($.keyword_database, $.identifier),
    seq($.keyword_function, $.object_reference, optional($.function_arguments)),
    seq($.keyword_materialized, $.keyword_view, $.object_reference),
    seq($.keyword_procedure, $.object_reference, optional($.function_arguments)),
    seq($.keyword_schema, $.identifier),
    seq($.keyword_sequence, $.object_reference),
    seq($.keyword_table, $.object_reference),
    seq($.keyword_view, $.object_reference),
    // Snowflake objects
    seq(choice(
      $.keyword_stream,
      $.keyword_task,
      $.keyword_pipe,
      $.keyword_stage,
      seq($.keyword_dynamic, $.keyword_table),
    ), $.object_reference),
  ),

};
