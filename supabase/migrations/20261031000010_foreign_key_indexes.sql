-- Index every foreign key in public, and drop exact duplicate indexes.
--
-- Postgres indexes the referenced side of a foreign key (it must be a primary
-- key or unique) but never the referencing columns. Without that index:
--   * a join from parent to children (bookings of an order, documents of a
--     visa application) scans the whole child table;
--   * deleting or re-keying a parent row checks every child table with a
--     sequential scan, under lock. Most of the unindexed columns point at
--     profiles (reviewed_by, created_by, actor_id), so deleting one profile
--     scans dozens of tables.
-- This is the Supabase advisor lint 0001_unindexed_foreign_keys. A database
-- built from these migrations has 117 such foreign keys.
--
-- Indexes are created from the live catalog at apply time, not from a list
-- copied off a developer database, so the migration is correct on whichever
-- database runs it and a second run is a no-op. A foreign key counts as
-- covered when a valid index starts with exactly its columns (in any order)
-- and either has no predicate or only excludes rows where that column is
-- null. The foreign key check (`where col = $1`) and joins on the column can
-- use both; the plan was confirmed with a generic prepared statement.
--
-- On a nullable column the new index skips null rows (`where col is not
-- null`), as the schema's existing foreign key indexes do: most of these
-- columns (reviewed_by, resolved_by) are null on most rows, and a null never
-- matches a parent.
--
-- New indexes are named <table>_<columns>_idx, the convention used across the
-- schema, truncated to fit the 63-byte identifier limit.
--
-- Locking: CREATE INDEX blocks writes to its table while it builds, and this
-- block runs in one transaction. Apply it outside peak hours. For a large
-- table, build its index first with CREATE INDEX CONCURRENTLY from psql; this
-- block then skips it.

-- ----------------------------------------------------------------------------
-- 1. Foreign key indexes
-- ----------------------------------------------------------------------------
do $$
declare
  r record;
  v_name text;
  v_n int;
begin
  for r in
    select c.conrelid,
           t.relname as table_name,
           c.conkey,
           string_agg(quote_ident(a.attname), ', ' order by k.ord) as col_list,
           string_agg(a.attname, '_' order by k.ord) as col_names,
           -- Single nullable column: the predicate the new index carries, and
           -- the only predicate an existing index may carry to count.
           case when count(*) = 1 and not bool_and(a.attnotnull)
                then format('(%s IS NOT NULL)', quote_ident(min(a.attname)))
           end as not_null_pred
    from pg_catalog.pg_constraint c
    join pg_catalog.pg_class t on t.oid = c.conrelid
    cross join lateral unnest(c.conkey) with ordinality as k(attnum, ord)
    join pg_catalog.pg_attribute a on a.attrelid = c.conrelid and a.attnum = k.attnum
    where c.contype = 'f'
      and t.relnamespace = 'public'::regnamespace
      and t.relkind = 'r'
    group by c.oid, c.conrelid, t.relname, c.conkey
    order by t.relname, col_names
  loop
    -- Already covered by an index whose leading columns are the FK columns.
    if exists (
      select 1
      from pg_catalog.pg_index i
      where i.indrelid = r.conrelid
        and i.indisvalid
        and (i.indpred is null or pg_get_expr(i.indpred, i.indrelid) = r.not_null_pred)
        and i.indnkeyatts >= array_length(r.conkey, 1)
        and (
          select array_agg(x order by x)
          from unnest((string_to_array(i.indkey::text, ' ')::int2[])[1:array_length(r.conkey, 1)]) as x
        ) = (select array_agg(x order by x) from unnest(r.conkey) as x)
    ) then
      continue;
    end if;

    v_name := left(r.table_name || '_' || r.col_names, 59) || '_idx';
    -- A different index may already hold that name; add a counter until free.
    v_n := 1;
    while exists (
      select 1 from pg_catalog.pg_class
      where relnamespace = 'public'::regnamespace and relname = v_name
    ) loop
      v_n := v_n + 1;
      v_name := left(r.table_name || '_' || r.col_names, 57) || v_n || '_idx';
    end loop;

    execute format('create index %I on public.%I (%s)', v_name, r.table_name, r.col_list)
      || coalesce(' where ' || r.not_null_pred, '');
  end loop;
end;
$$;

-- ----------------------------------------------------------------------------
-- 2. Exact duplicate indexes
-- ----------------------------------------------------------------------------
-- Two indexes with the same table, columns, operator classes, expressions,
-- predicate and uniqueness answer the same queries; the second one only costs
-- writes and memory (advisor lint 0009_duplicate_index). Keep the one backing
-- a constraint, else the oldest; drop the rest. Indexes that back a
-- constraint are never dropped.
do $$
declare
  r record;
begin
  for r in
    with idx as (
      select i.indexrelid,
             i.indrelid,
             ic.relname as index_name,
             exists (select 1 from pg_catalog.pg_constraint c where c.conindid = i.indexrelid) as backs_constraint,
             row_number() over (
               partition by i.indrelid, i.indkey::text, i.indclass::text, i.indcollation::text,
                            coalesce(pg_get_expr(i.indexprs, i.indrelid), ''),
                            coalesce(pg_get_expr(i.indpred, i.indrelid), ''),
                            i.indisunique, am.amname
               order by exists (select 1 from pg_catalog.pg_constraint c where c.conindid = i.indexrelid) desc,
                        i.indexrelid
             ) as rn
      from pg_catalog.pg_index i
      join pg_catalog.pg_class ic on ic.oid = i.indexrelid
      join pg_catalog.pg_class t on t.oid = i.indrelid
      join pg_catalog.pg_am am on am.oid = ic.relam
      where t.relnamespace = 'public'::regnamespace
        and i.indisvalid
    )
    select index_name from idx where rn > 1 and not backs_constraint
  loop
    execute format('drop index public.%I', r.index_name);
  end loop;
end;
$$;
