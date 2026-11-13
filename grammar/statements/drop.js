import { comma_list } from "../helpers.js";

export default {

  _drop_statement: $ => seq(
    choice(
      $.drop_table,
      $.drop_view,
      $.drop_schema,
      $.drop_database,
      $.drop_index,
      $.drop_function,
      $.drop_procedure,
      // Snowflake
      $.drop_snowflake_named_object,
      $.drop_snowflake_object,
    ),
  ),

  drop_table: $ => seq(
    $.keyword_drop,
    $.keyword_table,
    optional($._if_exists),
    $.object_reference,
    optional($._drop_behavior),
  ),

  drop_view: $ => seq(
    $.keyword_drop,
    $.keyword_view,
    optional($._if_exists),
    $.object_reference,
    optional($._drop_behavior),
  ),

  drop_schema: $ => seq(
    $.keyword_drop,
    $.keyword_schema,
    optional($._if_exists),
    $.identifier,
    optional($._drop_behavior)
  ),

  drop_database: $ => prec.left(seq(
    $.keyword_drop,
    $.keyword_database,
    optional($._if_exists),
    $.identifier,
    optional($._drop_behavior),
  )),

  // Snowflake hybrid tables: DROP INDEX [IF EXISTS] table.index
  drop_index: $ => seq(
    $.keyword_drop,
    $.keyword_index,
    optional($._if_exists),
    $.object_reference,
  ),

  drop_function: $ => prec.left(seq(
    $.keyword_drop,
    $.keyword_function,
    optional($._if_exists),
    $.object_reference,
    optional($.function_arguments),
    optional($._drop_behavior),
  )),

  drop_procedure: $ => prec.left(seq(
    $.keyword_drop,
    $.keyword_procedure,
    optional($._if_exists),
    $.object_reference,
    optional($.function_arguments),
    optional($._drop_behavior),
  )),

};
