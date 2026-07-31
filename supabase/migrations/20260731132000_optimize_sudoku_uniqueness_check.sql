-- Avoid running SQL subqueries for every solver candidate. Tight PL/pgSQL loops
-- keep extreme-room validation fast enough for an interactive create request.

CREATE OR REPLACE FUNCTION private.sudoku_candidate_is_valid(
  p_board smallint[],
  p_cell integer,
  p_value smallint
)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
STRICT
SET search_path TO ''
AS $function$
declare
  v_index integer;
  v_row_start integer;
  v_column integer;
  v_box_start integer;
  v_box_row integer;
  v_box_column integer;
begin
  if p_cell not between 1 and 81 or p_value not between 1 and 9 then
    return false;
  end if;

  v_row_start := ((p_cell - 1) / 9) * 9 + 1;
  for v_index in v_row_start..v_row_start + 8 loop
    if v_index <> p_cell and p_board[v_index] = p_value then
      return false;
    end if;
  end loop;

  v_column := (p_cell - 1) % 9 + 1;
  for v_index in 0..8 loop
    if v_column + v_index * 9 <> p_cell
       and p_board[v_column + v_index * 9] = p_value then
      return false;
    end if;
  end loop;

  v_box_start := ((p_cell - 1) / 27) * 27 + (((p_cell - 1) % 9) / 3) * 3 + 1;
  for v_box_row in 0..2 loop
    for v_box_column in 0..2 loop
      v_index := v_box_start + v_box_row * 9 + v_box_column;
      if v_index <> p_cell and p_board[v_index] = p_value then
        return false;
      end if;
    end loop;
  end loop;

  return true;
end;
$function$;

CREATE OR REPLACE FUNCTION private.sudoku_count_solutions(
  p_board smallint[],
  p_limit integer DEFAULT 2
)
RETURNS integer
LANGUAGE plpgsql
IMMUTABLE
STRICT
SET search_path TO ''
AS $function$
declare
  v_cell integer;
  v_best_cell integer := 0;
  v_best_mask integer := 0;
  v_best_candidate_count integer := 10;
  v_row_start integer;
  v_column integer;
  v_box_start integer;
  v_index integer;
  v_box_row integer;
  v_box_column integer;
  v_used integer;
  v_mask integer;
  v_mask_copy integer;
  v_candidate_count integer;
  v_candidate integer;
  v_next smallint[];
  v_solution_count integer := 0;
begin
  if p_limit <= 0
     or array_ndims(p_board) <> 1
     or array_lower(p_board, 1) <> 1
     or array_upper(p_board, 1) <> 81 then
    return 0;
  end if;

  for v_cell in 1..81 loop
    if p_board[v_cell] is null or p_board[v_cell] not between 0 and 9 then
      return 0;
    end if;
    if p_board[v_cell] <> 0 then
      continue;
    end if;

    v_used := 0;
    v_row_start := ((v_cell - 1) / 9) * 9 + 1;
    for v_index in v_row_start..v_row_start + 8 loop
      if p_board[v_index] > 0 then
        v_used := v_used | (1 << p_board[v_index]::integer);
      end if;
    end loop;

    v_column := (v_cell - 1) % 9 + 1;
    for v_index in 0..8 loop
      if p_board[v_column + v_index * 9] > 0 then
        v_used := v_used | (1 << p_board[v_column + v_index * 9]::integer);
      end if;
    end loop;

    v_box_start := ((v_cell - 1) / 27) * 27 + (((v_cell - 1) % 9) / 3) * 3 + 1;
    for v_box_row in 0..2 loop
      for v_box_column in 0..2 loop
        v_index := v_box_start + v_box_row * 9 + v_box_column;
        if p_board[v_index] > 0 then
          v_used := v_used | (1 << p_board[v_index]::integer);
        end if;
      end loop;
    end loop;

    v_mask := 1022 & ~v_used;
    if v_mask = 0 then
      return 0;
    end if;

    v_candidate_count := 0;
    v_mask_copy := v_mask;
    while v_mask_copy > 0 loop
      v_candidate_count := v_candidate_count + (v_mask_copy & 1);
      v_mask_copy := v_mask_copy >> 1;
    end loop;

    if v_candidate_count < v_best_candidate_count then
      v_best_cell := v_cell;
      v_best_mask := v_mask;
      v_best_candidate_count := v_candidate_count;
      if v_candidate_count = 1 then
        exit;
      end if;
    end if;
  end loop;

  if v_best_cell = 0 then
    return 1;
  end if;

  for v_candidate in 1..9 loop
    if (v_best_mask & (1 << v_candidate)) <> 0 then
      v_next := p_board;
      v_next[v_best_cell] := v_candidate::smallint;
      v_solution_count := v_solution_count
        + private.sudoku_count_solutions(v_next, p_limit - v_solution_count);
      if v_solution_count >= p_limit then
        return v_solution_count;
      end if;
    end if;
  end loop;

  return v_solution_count;
end;
$function$;

REVOKE ALL ON FUNCTION private.sudoku_candidate_is_valid(smallint[], integer, smallint) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.sudoku_count_solutions(smallint[], integer) FROM PUBLIC;
