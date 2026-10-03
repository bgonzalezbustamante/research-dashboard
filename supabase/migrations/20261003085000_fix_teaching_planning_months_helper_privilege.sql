-- Restore the minimum runtime privilege required by the Teaching Portfolio
-- planning_months CHECK constraint. The constraint calls this immutable helper
-- while authenticated users create or update Teaching Portfolio rows.

revoke all
  on function private.integer_array_has_unique_values(integer[])
  from public, anon;

grant execute
  on function private.integer_array_has_unique_values(integer[])
  to authenticated, service_role;
