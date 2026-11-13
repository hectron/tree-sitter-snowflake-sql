import { make_keyword, comma_list, paren_list, wrapped_in_parenthesis } from "./helpers.js";

export default {

  _type: $ => prec.left(
    seq(
      choice(
        $.keyword_boolean,
        $.binary,
        $.varbinary,


        $.tinyint,
        $.smallint,
        $.int,
        $.bigint,
        $.decimal,
        $.numeric,
        $.double,
        $.float,


        $.char,
        $.varchar,
        $.nchar,
        $.nvarchar,
        $.keyword_string,
        $.keyword_text,





        $.keyword_date,
        $.keyword_datetime,
        $.datetime_type,
        $.time,
        $.timestamp,
        $.keyword_timestamptz,

        $.keyword_geometry,
        $.keyword_geography,


        // Snowflake semi-structured types
        $.keyword_variant,
        $.keyword_object,
        $.object_type,
        $.period_type,

        // Snowflake structured types MAP(k, v), ARRAY, ARRAY(type)
        $.map_type,
        $.structured_array_type,

        // Snowflake numeric
        $.number,

        // Snowflake timestamp variants
        $.timestamp_ltz,
        $.timestamp_ntz,
        $.timestamp_tz,

        // Snowflake vector type
        $.vector,

        // Snowflake scripting types
        $.keyword_resultset,
        $.keyword_cursor,

        field("custom_type", $.object_reference)
      ),
    ),
  ),

  // MAP(key_type, value_type)
  map_type: $ => seq(
    $.keyword_map,
    '(',
    field('key', $._type),
    ',',
    field('value', $._type),
    ')',
  ),

  // Snowflake ARRAY or structured ARRAY(element_type), as in DROP PROCEDURE p(ARRAY(VARCHAR))
  structured_array_type: $ => seq(
    $.keyword_array,
    optional(seq(
      '(',
      field('element', $._type),
      ')',
    )),
  ),

  tinyint: $ => parametric_type($, $.keyword_tinyint),
  smallint: $ => parametric_type($, $.keyword_smallint),
  int: $ => parametric_type($, $.keyword_int),
  bigint: $ => parametric_type($, $.keyword_bigint),

  binary: $ => parametric_type($, $.keyword_binary, ['precision']),
  varbinary: $ => parametric_type($, $.keyword_varbinary, ['precision']),

  // TODO: should qualify against /\\b(0?[1-9]|[1-4][0-9]|5[0-4])\\b/g
  float: $  => choice(
    parametric_type($, $.keyword_float, ['precision']),
    parametric_type($, $.keyword_float, ['precision', 'scale']),
  ),

  double: $ => choice(
    make_keyword("float8"),
    parametric_type($, $.keyword_double, ['precision', 'scale']),
    parametric_type($, seq($.keyword_double, $.keyword_precision), ['precision', 'scale']),
    parametric_type($, $.keyword_real, ['precision', 'scale']),
  ),

  decimal: $ => choice(
    parametric_type($, $.keyword_decimal, ['precision']),
    parametric_type($, $.keyword_decimal, ['precision', 'scale']),
  ),
  numeric: $ => choice(
    parametric_type($, $.keyword_numeric, ['precision']),
    parametric_type($, $.keyword_numeric, ['precision', 'scale']),
  ),
  char: $ => parametric_type($, $.keyword_char),
  varchar: $ => parametric_type($, $.keyword_varchar),
  nchar: $ => parametric_type($, $.keyword_nchar),
  nvarchar: $ => parametric_type($, $.keyword_nvarchar),

  time: $ => parametric_type($, $.keyword_time),
  // TIMESTAMP[(p)], plus the Snowflake synonyms TIMESTAMP WITH TIME ZONE (TIMESTAMP_TZ),
  // TIMESTAMP WITH LOCAL TIME ZONE (TIMESTAMP_LTZ) and TIMESTAMP WITHOUT TIME ZONE (TIMESTAMP_NTZ)
  timestamp: $ => seq(
    parametric_type($, $.keyword_timestamp),
    optional(field('time_zone', $.time_zone_suffix)),
  ),
  time_zone_suffix: $ => choice(
    seq($.keyword_with, optional($.keyword_local), $.keyword_time, $.keyword_zone),
    seq($.keyword_without, $.keyword_time, $.keyword_zone),
  ),

  // Snowflake types
  number: $ => choice(
    parametric_type($, $.keyword_number, ['precision']),
    parametric_type($, $.keyword_number, ['precision', 'scale']),
  ),
  // DATETIME(precision) (alias of TIMESTAMP_NTZ)
  datetime_type: $ => seq($.keyword_datetime, wrapped_in_parenthesis(alias($._natural_number, $.literal))),
  timestamp_ltz: $ => parametric_type($, $.keyword_timestamp_ltz),
  timestamp_ntz: $ => parametric_type($, $.keyword_timestamp_ntz),
  timestamp_tz: $ => parametric_type($, $.keyword_timestamp_tz),
  // VECTOR(INT, 256) or VECTOR(FLOAT, 768)
  vector: $ => seq(
    $.keyword_vector,
    '(',
    field('element_type', $.identifier),
    ',',
    field('dimension', alias($._natural_number, $.literal)),
    ')',
  ),

  array: $ => choice(
    seq(
      $.keyword_array,
      choice(
        seq(
          "[",
          comma_list($._expression),
          "]"
        ),
        seq(
          "(",
          $._dml_read,
          ")",
        )
      )
    ),
    // Standalone array literal: ['a', 'b', 'c'] (sugar for ARRAY_CONSTRUCT)
    seq(
      "[",
      comma_list($._expression),
      "]"
    ),
  ),

};

function parametric_type($, type, params = ['size']) {
  return prec.right(1,
    choice(
      type,
      seq(
        type,
        wrapped_in_parenthesis(
          seq(
            // first parameter is guaranteed, shift it out of the array
            field(params.shift(), alias($._natural_number, $.literal)),
            // then, fill in the ", next" until done
            ...params.map(p => seq(',', field(p, alias($._natural_number, $.literal)))),
          ),
        ),
      ),
    ),
  )
}
