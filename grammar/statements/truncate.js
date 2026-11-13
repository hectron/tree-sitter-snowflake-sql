export default {

  // Snowflake: TRUNCATE [TABLE] [IF EXISTS] name
  _truncate_statement: $ => seq(
    $.keyword_truncate,
    optional($.keyword_table),
    optional($._if_exists),
    $.object_reference,
  ),

};
