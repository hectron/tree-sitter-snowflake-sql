export default {

  // Snowflake session variables: SET name = value | SET (a, b, ...) = (x, y, ...)
  set_statement: $ => seq(
    $.keyword_set,
    choice(
      seq($.object_reference, '=', $._expression),
      seq(
        '(', $.object_reference, repeat(seq(',', $.object_reference)), ')',
        '=',
        '(', $._expression, repeat(seq(',', $._expression)), ')',
      ),
    ),
  ),

};
