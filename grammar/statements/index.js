import { optional_parenthesis, wrapped_in_parenthesis } from "../helpers.js";

import create_rules from "./create.js";
import alter_rules from "./alter.js";
import drop_rules from "./drop.js";
import merge_rules from "./merge.js";
import comment_rules from "./comment.js";
import delete_rules from "./delete.js";
import insert_rules from "./insert.js";
import update_rules from "./update.js";
import truncate_rules from "./truncate.js";
import select_rules from "./select.js";
import query_extras_rules from "./query-extras.js";
import set_rules from "./set.js";
import snowflake_ddl_rules from "./snowflake-ddl.js";
import snowflake_scripting_rules from "./snowflake-scripting.js";

export default {

  // Top-level block — now delegates to the full Snowflake scripting block
  block: $ => $.snowflake_scripting_block,

  statement: $ => seq(
    optional(seq($.keyword_explain, optional(seq($.keyword_using, $.identifier)))),
    choice(
      $._ddl_statement,
      $._dml_write,
      optional_parenthesis($._dml_read),
    ),
  ),

  _ddl_statement: $ => choice(
    $._create_statement,
    $._alter_statement,
    $._drop_statement,
    $._merge_statement,
    $.comment_statement,
    $.set_statement,
    // Snowflake DDL
    $.grant_statement,
    $.revoke_statement,
    $.snowflake_statement,
  ),

  ...create_rules,
  ...alter_rules,
  ...drop_rules,
  ...merge_rules,
  ...comment_rules,

  _dml_write: $ => seq(
    seq(
      optional(
        $._cte,
      ),
      choice(
        $._delete_statement,
        $._insert_statement,
        $.multi_table_insert,
        $._update_statement,
        $._truncate_statement,
        // Snowflake
        $.snowflake_copy_into,
      ),
    ),
  ),

  ...delete_rules,
  ...insert_rules,
  ...update_rules,
  ...truncate_rules,

  _dml_read: $ => seq(
    optional(optional_parenthesis($._cte)),
    choice(
      $._dml_read_body,
      seq('(', $._dml_read_body, ')'),
    ),
  ),

  _dml_read_body: $ => choice(
    $._select_statement,
    $.set_operation,
    $._show_statement,
    prec(-1, $.snowflake_show_statement),
  ),

  // SHOW ... ->> SELECT ... FROM $1 (result of the previous statement as $1)
  pipe_query: $ => seq(
    choice($._show_statement, $.snowflake_show_statement),
    alias($.op_other, $.pipe_operator), $._select_statement,
  ),

  ...select_rules,
  ...query_extras_rules,
  ...set_rules,

  _show_statement: $ => seq(
    $.keyword_show,
    optional($.keyword_terse),
    $.snowflake_show_target,
    optional(seq($.keyword_root, $.keyword_only)),
    optional($.keyword_history),
  ),

  ...snowflake_ddl_rules,
  ...snowflake_scripting_rules,

};
