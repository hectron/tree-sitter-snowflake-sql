export default {

  _update_statement: $ => $.update,

  // Snowflake: UPDATE t SET col = expr [, ..] [FROM source [, ..]] [WHERE cond]
  update: $ => seq(
    $.keyword_update,
    $.relation,
    $._set_values,
    optional($.from),
    optional($.where),
  ),

};
