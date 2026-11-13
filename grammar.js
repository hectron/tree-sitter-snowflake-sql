import keyword_rules from "./grammar/keywords.js";
import type_rules from "./grammar/types.js";
import column_list_rules from "./grammar/column-lists.js";
import expression_rules from "./grammar/expressions.js";
import transaction_rules from "./grammar/transactions.js";
import expr_extras_rules from "./grammar/expr-extras.js";
import statement_rules from "./grammar/statements/index.js";

export default grammar({
  name: 'snowflake_sql',

  extras: $ => [
    /\s\n/,
    /\s/,
    $.comment,
    $.marginalia,
  ],


  externals: $ => [
    $._dollar_quoted_string_start_tag,
    $._dollar_quoted_string_end_tag,
    $._dollar_quoted_string,
  ],

  conflicts: $ => [
    // TIMESTAMP WITH TIME ZONE (type synonym) vs TIMESTAMP followed by a WITH MASKING POLICY / WITH TAG column clause
    [$.timestamp],
    // a JOIN b JOIN c ON x ON y (nested) vs flat joins with optional ON
    [$.join],
    // CREATE STREAM s COPY GRANTS [ON ..] COPY = (..): leading vs trailing copy clause
    [$.create_stream],
    // ALTER TABLE t SET TAG a = 1, b = 2 : tag list continuation vs next alter specification
    [$.tag_assignments],
    [$.tag_names],
    // POSITION(a IN b): operands are plain expressions that cannot begin an IN list
    [$._position_haystack, $._expression],
    // lambda parameter name vs a field expression (x -> ..., (a, b) -> ...)
    [$._qualified_field, $.lambda_parameter],
    [$.object_reference, $._qualified_field, $.lambda_parameter],
    // ((SELECT 1) + 2): inner (SELECT ..) is a wrapped select or a scalar subquery operand; let GLR decide
    [$._select_statement],
    [$._dml_read],
    [$.object_reference, $._qualified_field],
    [$.field, $._qualified_field],
    [$.object_reference],
    [$.between_expression, $.binary_expression],
    [$._qualified_field, $.variant_access],
    // FOR x IN cursor_name — cursor_name could be identifier or start of object_reference
    [$.object_reference, $.for_statement],
    // CURSOR FOR name — name could be identifier or start of object_reference
    [$.object_reference, $.snowflake_declare_cursor],
    // LET var CURSOR FOR name — same ambiguity
    [$.object_reference, $.let_statement],
    // SQL UDF body: AS $$ (SELECT ...) $$ is either a parenthesized statement
    // or a scalar subquery expression
    [$.subquery, $.statement],
    // BEGIN TRANSACTION; inside a block: standalone, or the start of a paired scripting_transaction
    [$.begin_transaction_statement, $.scripting_transaction],
    // v:a.b — dotted variant path vs a[x:y.z] slice bound that is a qualified name
    [$.variant_access, $.object_reference],
    // INSERT ALL INTO t VALUES (..): VALUES belongs to the INTO clause, not a following bare VALUES query
    [$.multi_insert_into],
    // -1: signed literal vs unary sign applied to a literal
    [$._integer],
    [$._decimal_number],
    // BEGIN; could start a scripting block or a standalone begin_transaction_statement
    [$.begin_transaction_statement, $.snowflake_scripting_block],
    // BEGIN TRANSACTION; could be standalone or start a full transaction block
    [$.begin_transaction_statement, $.transaction],
    // COMMIT inside scripting: standalone commit_statement vs scripting_transaction terminator
    [$.commit_statement, $.scripting_transaction],
    // ROLLBACK inside scripting: standalone rollback_statement vs scripting_transaction terminator
    [$.rollback_statement, $.scripting_transaction],
  ],

  precedences: $ => [
    [
      'binary_is',
      'unary_not',
      'binary_exp',
      'unary_sign',
      'binary_times',
      'binary_plus',
      'unary_other',
      'binary_other',
      'binary_in',
      'binary_compare',
      'binary_relation',
      'pattern_matching',
      'between',
      'clause_connective',
      'clause_disjunctive',
    ],
  ],

  word: $ => $._identifier,

  rules: {
    program: $ => seq(
      // any number of transactions, statements, or blocks with a terminating ;
      repeat(
        seq(
          choice(
            $.transaction,
            $.statement,
            $.block,
            $.commit_statement,
            $.rollback_statement,
            $.begin_transaction_statement,
          ),
          repeat1(';'),
        ),
      ),
      // optionally, a single statement without a terminating ;
      optional(
        $.statement,
      ),
    ),

    // -- and // line comments (Snowflake accepts both)
    comment: _ => /(--|\/\/).*/,
    // https://stackoverflow.com/questions/13014947/regex-to-match-a-c-style-multiline-comment
    marginalia: _ => /\/\*[^*]*\*+(?:[^/*][^*]*\*+)*\//,

    ...keyword_rules,
    ...type_rules,
    ...column_list_rules,
    ...expression_rules,
    ...expr_extras_rules,
    ...transaction_rules,
    ...statement_rules,

  }

});
