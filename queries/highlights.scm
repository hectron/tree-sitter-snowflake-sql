; Identifiers and references

(object_reference
  name: (identifier) @type)

(invocation
  (object_reference
    name: (identifier) @function.call))

[
  (keyword_array)
] @function.call

(relation
  alias: (identifier) @variable)

(field
  name: (identifier) @variable.member)

(term
  alias: (identifier) @variable)

((term
   value: (cast
    name: (keyword_cast) @function.call
    parameter: [(literal)]?)))

; Snowflake: TRY_CAST as function
((term
   value: (try_cast
    name: (keyword_try_cast) @function.call
    parameter: [(literal)]?)))

; Literals

(literal) @string
(comment) @comment @spell
(marginalia) @comment

((literal) @number
   (#match? @number "^[-+]?\\d+$"))

((literal) @number.float
  (#match? @number.float "^[-+]?\\d*\\.\\d*$"))

(parameter) @variable.parameter

[
 (keyword_true)
 (keyword_false)
] @boolean

; Snowflake: stage references (@~, @%table, @stage/path), file:// and cloud storage URLs
(stage_reference) @string.special
(file_url) @string.special
(external_location) @string.special

; Snowflake: variant path access (col:key, col:key.nested)
(variant_access) @variable.member

; Snowflake: named parameters (param => value)
(named_parameter
  name: (identifier) @variable.parameter)

; Attributes

[
 (keyword_asc)
 (keyword_desc)
 (keyword_nulls)
 (keyword_last)
 (keyword_autoincrement)
 (keyword_default)
 (keyword_collate)
 (keyword_always)
 (keyword_generated)
 (keyword_preceding)
 (keyword_following)
 (keyword_first)
  (keyword_current_timestamp)
  (keyword_current_date)
 (keyword_immutable)
 (keyword_strict)
] @attribute

; Modifiers (storage class → keyword.modifier)

[
 (keyword_materialized)
 (keyword_recursive)
 (keyword_temp)
 (keyword_temporary)
 (keyword_external)
 (keyword_volatile)
 (keyword_dynamic)
] @keyword.modifier

; Snowflake scripting: variable references (:var)
(snowflake_variable_reference) @variable
(snowflake_session_variable) @variable

; Conditionals (conditional → keyword.conditional)

[
 (keyword_case)
 (keyword_when)
 (keyword_then)
 (keyword_else)
 (keyword_elseif)
] @keyword.conditional

; Loops (repeat → keyword.repeat)

[
 (keyword_loop)
 (keyword_repeat)
] @keyword.repeat

; Keywords

[
  (keyword_select)
  (keyword_from)
  (keyword_where)
  (keyword_join)
  (keyword_primary)
  (keyword_delete)
  (keyword_create)
  (keyword_show)

  (keyword_insert)
  (keyword_merge)
  (keyword_distinct)
  (keyword_replace)
  (keyword_update)
  (keyword_into)
  (keyword_overwrite)
  (keyword_matched)
  (keyword_values)
  (keyword_set)
  (keyword_left)
  (keyword_right)
  (keyword_outer)
  (keyword_inner)
  (keyword_full)
  (keyword_order)
  (keyword_partition)
  (keyword_group)
  (keyword_with)
  (keyword_as)
  (keyword_having)
  (keyword_limit)
  (keyword_offset)
  (keyword_table)
  (keyword_key)
  (keyword_references)
  (keyword_foreign)
  (keyword_constraint)
  (keyword_use)
  (keyword_for)
  (keyword_if)
  (keyword_exists)
  (keyword_column)
  (keyword_cross)
  (keyword_lateral)
  (keyword_natural)
  (keyword_alter)
  (keyword_drop)
  (keyword_add)
  (keyword_view)
  (keyword_end)
  (keyword_is)
  (keyword_using)
  (keyword_between)
  (keyword_window)
  (keyword_no)
  (keyword_data)
  (keyword_type)
  (keyword_rename)
  (keyword_to)
  (keyword_schema)
  (keyword_owner)
  (keyword_all)
  (keyword_any)
  (keyword_some)
  (keyword_begin)
  (keyword_commit)
  (keyword_rollback)
  (keyword_transaction)
  (keyword_only)
  (keyword_like)
  (keyword_rlike)
  (keyword_over)
  (keyword_modify)
  (keyword_after)
  (keyword_range)
  (keyword_rows)
  (keyword_exclude)
  (keyword_current)
  (keyword_row)
  (keyword_comment)
  (keyword_explain)
  (keyword_truncate)

  (keyword_language)
  (keyword_await)
  (keyword_clone)
  (keyword_hybrid)
  (keyword_policy)
  (keyword_future)
  (keyword_index)
  (keyword_include)
  (keyword_masking)
  (keyword_access)
  (keyword_list)
  (keyword_pattern)
  (keyword_sample)
  (keyword_tablesample)
  (keyword_bernoulli)
  (keyword_seed)
  (keyword_search)
  (keyword_optimization)
  (keyword_clustering)
  (keyword_iceberg)
  (keyword_transient)
  (keyword_runtime_version)
  (keyword_handler)
  (keyword_imports)
  (keyword_packages)
  (keyword_target_path)
  (keyword_external_access_integrations)
  (keyword_secrets)
  (keyword_secure)
  (keyword_grants)
  (keyword_python)
  (keyword_java)
  (keyword_javascript)
  (keyword_scala)
  (keyword_called)
  (keyword_declare)
  (keyword_function)
  (keyword_input)
  (keyword_alert)
  (keyword_before)
  (keyword_block)
  (keyword_cluster)
  (keyword_increment)
  (keyword_metric)
  (keyword_name)
  (keyword_noorder)
  (keyword_pipe)
  (keyword_public)
  (keyword_refresh)
  (keyword_sequence)
  (keyword_stage)
  (keyword_start)
  (keyword_stream)
  (keyword_system)
  (keyword_tag)
  (keyword_task)
  (keyword_warehouse)
  (keyword_work)
  (keyword_out)
  (keyword_output)
  (keyword_local)
  (keyword_zone)
  (keyword_without)
  (keyword_precision)
  (keyword_restricted)
  (keyword_return)
  (keyword_returns)
  (keyword_database)
  (keyword_role)
  (keyword_until)
  (keyword_user)
  (keyword_action)

  (keyword_session)
  (keyword_repeatable)
  (keyword_immediate)
  (keyword_procedure)
  (keyword_copy)
  (keyword_while)

  (keyword_describe)
  (keyword_call)
  (keyword_undrop)
  (keyword_put)
  (keyword_get)
  (keyword_suspend)
  (keyword_resume)
  (keyword_within)
  (keyword_execute)
  (keyword_account)
  (keyword_qualify)
  (keyword_grant)
  (keyword_revoke)
  (keyword_privileges)
  (snowflake_object_type)
  (snowflake_show_target)
  (snowflake_scope_type)
  (snowflake_alter_object_type)
  (snowflake_drop_object_type)
  (snowflake_create_object_type)

  ; Snowflake scripting
  (keyword_let)
  (keyword_resultset)
  (keyword_cursor)
  (keyword_exception)
  (keyword_raise)
  (keyword_break)
  (keyword_continue)
  (keyword_iterate)
  (keyword_exit)
  (keyword_open)
  (keyword_fetch)
  (keyword_close)
  (keyword_async)
  (keyword_other)
  (keyword_reverse)
  (keyword_caller)
  (keyword_terse)
  (keyword_identifier)
  (keyword_unset)
  (keyword_root)
  (keyword_remove)
  (keyword_event)
] @keyword

; Qualifiers

[
 (keyword_restrict)
 (keyword_unbounded)
 (keyword_unique)
 (keyword_cascade)
 (keyword_option)
] @type.qualifier

; Types

[
  (keyword_int)
  (keyword_null)
  (keyword_boolean)
  (keyword_binary)
  (keyword_varbinary)
  (keyword_smallint)
  (keyword_bigint)
  (keyword_tinyint)
  (keyword_decimal)
  (keyword_float)
  (keyword_double)
  (keyword_numeric)
  (keyword_real)
  (double)
  (keyword_char)
  (keyword_nchar)
  (keyword_varchar)
  (keyword_nvarchar)
  (keyword_varying)
  (keyword_text)
  (keyword_string)
  (keyword_date)
  (keyword_datetime)
  (keyword_time)
  (keyword_timestamp)
  (keyword_timestamptz)
  (keyword_geometry)
  (keyword_geography)
  (keyword_interval)
  (keyword_variant)
  (keyword_map)
  (keyword_object)
  (keyword_number)
  (keyword_vector)
  (keyword_timestamp_ltz)
  (keyword_timestamp_ntz)
  (keyword_timestamp_tz)
] @type.builtin

; Keyword operators

[
  (keyword_in)
  (keyword_and)
  (keyword_or)
  (keyword_not)
  (keyword_by)
  (keyword_on)
  (keyword_do)
  (keyword_union)
  (keyword_except)
  (keyword_intersect)
] @keyword.operator

; Operators

[
  "+"
  "-"
  "*"
  "/"
  "%"
  ":="
  "="
  "<"
  "<="
  "!="
  ">="
  ">"
  "<>"
  (op_other)
] @operator

; Punctuation

[
  "("
  ")"
  "{"
  "}"
] @punctuation.bracket

[
  ";"
  ","
  "."
] @punctuation.delimiter

;; AUTO-KEYWORDS-START
[
 (keyword_from_first)
 (keyword_from_last)
 (keyword_at)
 (keyword_changes)
 (keyword_pivot)
 (keyword_unpivot)
 (keyword_match_recognize)
 (keyword_resample)
 (keyword_asof)
 (keyword_match_condition)
 (keyword_directed)
 (keyword_connect)
 (keyword_prior)
 (keyword_grouping)
 (keyword_sets)
 (keyword_cube)
 (keyword_rollup)
 (keyword_top)
 (keyword_information)
 (keyword_append_only)
 (keyword_statement)
 (keyword_measures)
 (keyword_define)
 (keyword_match)
 (keyword_skip)
 (keyword_past)
 (keyword_one)
 (keyword_per)
 (keyword_final)
 (keyword_running)
 (keyword_permute)
 (keyword_metadata_columns)
 (keyword_semantic_view)
 (keyword_metrics)
 (keyword_dimensions)
 (keyword_facts)
 (keyword_empty)
 (keyword_matches)
 (keyword_omit)
 (keyword_unmatched)
 (keyword_next)
 (keyword_connect_by_root)
 (keyword_escape)
 (keyword_ignore)
 (keyword_respect)
 (keyword_period)
 (keyword_position)
 (keyword_starts)
 (keyword_of)
 (keyword_inherited)
 (keyword_enforced)
 (keyword_deferrable)
 (keyword_initially)
 (keyword_deferred)
 (keyword_enable)
 (keyword_disable)
 (keyword_validate)
 (keyword_novalidate)
 (keyword_rely)
 (keyword_norely)
 (keyword_swap)
 (keyword_recluster)
 (keyword_tags)
 (keyword_check)
 (keyword_virtual)
 (keyword_identity)
 (keyword_template)
 (keyword_contact)
 (keyword_aggregation)
 (keyword_lifecycle)
 (keyword_entity)
 (keyword_allowed)
 (keyword_keys)
 (keyword_backup)
 (keyword_global)
 (keyword_storage)
 (keyword_projection)
 (keyword_managed)
 (keyword_require)
 (keyword_frozen)
 (keyword_tables)
 (keyword_insufficient)
 (keyword_retention)
 (keyword_files)
 (keyword_rm)
 (keyword_ls)
 (keyword_force)
 (keyword_body)
 (keyword_expectation)
 (keyword_interactive)
 (keyword_policy_context)
 (keyword_allowed_values)
 (keyword_version_tag)
 (keyword_history)
 (keyword_purge)
 (keyword_nopurge)
 (keyword_relationships)
 (keyword_synonyms)
 (keyword_private)
 (keyword_convert)
 (keyword_upgrade)
 (keyword_optimize)
 (keyword_materialization)
 (keyword_version)
 (keyword_retry)
 (keyword_graph)
 (keyword_run)
 (keyword_location)
 (keyword_discovery)
 (keyword_task_defaults)
] @keyword
;; AUTO-KEYWORDS-END
