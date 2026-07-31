-- Prevent every known path that can make a valid-looking move consume multiple
-- mistakes: reject multi-solution rooms, remember rejected cell/value pairs,
-- and return an explicit move result to clients.

CREATE OR REPLACE FUNCTION private.sudoku_candidate_is_valid(
  p_board smallint[],
  p_cell integer,
  p_value smallint
)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
STRICT
SET search_path TO ''
AS $function$
  select p_cell between 1 and 81
    and p_value between 1 and 9
    and not exists (
      select 1
      from generate_series(((p_cell - 1) / 9) * 9 + 1, ((p_cell - 1) / 9) * 9 + 9) s
      where s <> p_cell and p_board[s] = p_value
    )
    and not exists (
      select 1
      from generate_series(0, 8) row_number
      where ((p_cell - 1) % 9) + 1 + row_number * 9 <> p_cell
        and p_board[((p_cell - 1) % 9) + 1 + row_number * 9] = p_value
    )
    and not exists (
      select 1
      from generate_series(0, 2) box_row,
           generate_series(0, 2) box_column
      where (
        ((p_cell - 1) / 27) * 27
        + (((p_cell - 1) % 9) / 3) * 3
        + box_row * 9 + box_column + 1
      ) <> p_cell
      and p_board[
        ((p_cell - 1) / 27) * 27
        + (((p_cell - 1) % 9) / 3) * 3
        + box_row * 9 + box_column + 1
      ] = p_value
    );
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
  v_candidate smallint;
  v_next smallint[];
  v_count integer := 0;
begin
  if p_limit <= 0
     or array_ndims(p_board) <> 1
     or array_lower(p_board, 1) <> 1
     or array_upper(p_board, 1) <> 81
     or exists (
       select 1 from generate_series(1, 81) s
       where p_board[s] is null or p_board[s] not between 0 and 9
     ) then
    return 0;
  end if;

  select empty_cell
  into v_cell
  from generate_series(1, 81) empty_cell
  where p_board[empty_cell] = 0
  order by (
    select count(*)
    from generate_series(1, 9) candidate
    where private.sudoku_candidate_is_valid(p_board, empty_cell, candidate::smallint)
  )
  limit 1;

  if v_cell is null then
    return 1;
  end if;

  for v_candidate in 1..9 loop
    if private.sudoku_candidate_is_valid(p_board, v_cell, v_candidate::smallint) then
      v_next := p_board;
      v_next[v_cell] := v_candidate;
      v_count := v_count + private.sudoku_count_solutions(v_next, p_limit - v_count);
      exit when v_count >= p_limit;
    end if;
  end loop;

  return v_count;
end;
$function$;

CREATE OR REPLACE FUNCTION private.sudoku_validate_room_puzzle()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $function$
declare
  v_expected_holes integer;
begin
  if array_ndims(new.puzzle) <> 1
     or array_lower(new.puzzle, 1) <> 1
     or array_upper(new.puzzle, 1) <> 81
     or array_ndims(new.solution) <> 1
     or array_lower(new.solution, 1) <> 1
     or array_upper(new.solution, 1) <> 81
     or array_ndims(new.board) <> 1
     or array_lower(new.board, 1) <> 1
     or array_upper(new.board, 1) <> 81 then
    raise exception '퍼즐 데이터가 올바르지 않습니다.';
  end if;

  v_expected_holes := case new.difficulty
    when 'veryEasy' then 32
    when 'easy' then 38
    when 'medium' then 45
    when 'hard' then 50
    when 'expert' then 54
    when 'master' then 57
    when 'extreme' then 60
    else null
  end;

  if v_expected_holes is null then
    raise exception '지원하지 않는 난이도입니다.';
  end if;

  if exists (
    select 1
    from generate_series(1, 81) s
    where new.solution[s] is null
       or new.solution[s] not between 1 and 9
       or new.puzzle[s] is null
       or new.puzzle[s] not between 0 and 9
       or new.board[s] is null
       or new.board[s] not between 0 and 9
       or (new.puzzle[s] <> 0 and new.puzzle[s] <> new.solution[s])
       or (new.puzzle[s] <> 0 and new.board[s] <> new.puzzle[s])
  ) then
    raise exception '퍼즐과 해답 데이터가 올바르지 않습니다.';
  end if;

  if (select count(*) from generate_series(1, 81) s where new.puzzle[s] = 0)
     <> v_expected_holes then
    raise exception '난이도와 빈칸 수가 일치하지 않습니다.';
  end if;

  if exists (
    select 1 from generate_series(0, 8) row_number
    where (
      select count(distinct new.solution[row_number * 9 + column_number + 1])
      from generate_series(0, 8) column_number
    ) <> 9
  ) or exists (
    select 1 from generate_series(0, 8) column_number
    where (
      select count(distinct new.solution[row_number * 9 + column_number + 1])
      from generate_series(0, 8) row_number
    ) <> 9
  ) or exists (
    select 1 from generate_series(0, 8) box_number
    where (
      select count(distinct new.solution[
        ((box_number / 3) * 3 + cell_number / 3) * 9
        + (box_number % 3) * 3 + cell_number % 3 + 1
      ])
      from generate_series(0, 8) cell_number
    ) <> 9
  ) then
    raise exception '올바른 스도쿠 해답이 아닙니다.';
  end if;

  if private.sudoku_count_solutions(new.puzzle, 2) <> 1 then
    raise exception '해답이 하나로 확정되는 퍼즐만 사용할 수 있습니다.';
  end if;

  return new;
end;
$function$;

ALTER TABLE public.sudoku_room_players
  ADD COLUMN IF NOT EXISTS wrong_attempts jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE OR REPLACE FUNCTION public.sudoku_place_number_v1(
  p_room_code text,
  p_player_id uuid,
  p_session_token text,
  p_cell integer,
  p_value smallint
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
declare
  v_code text := upper(trim(p_room_code));
  v_room public.sudoku_rooms;
  v_player public.sudoku_room_players;
  v_values smallint[];
  v_mistakes smallint;
  v_progress smallint;
  v_seconds integer;
  v_score integer;
  v_multiplier numeric;
  v_wrong_attempts jsonb;
  v_attempt_key text;
  v_accepted boolean := false;
  v_mistake_added boolean := false;
begin
  if p_cell is null or p_value is null
     or p_cell not between 0 and 80
     or p_value not between 0 and 9 then
    raise exception '입력값이 올바르지 않습니다.';
  end if;
  if not private.sudoku_valid_token(v_code, p_player_id, p_session_token) then
    raise exception '참가자 인증에 실패했습니다.';
  end if;

  select * into v_room
  from public.sudoku_rooms
  where room_code = v_code
  for update;

  if not found or v_room.status <> 'playing' then
    raise exception '진행 중인 게임이 아닙니다.';
  end if;
  if v_room.puzzle[p_cell + 1] <> 0 then
    raise exception '주어진 숫자는 변경할 수 없습니다.';
  end if;

  select * into v_player
  from public.sudoku_room_players
  where room_code = v_code and player_id = p_player_id
  for update;

  if not found then
    raise exception '참가자를 찾을 수 없습니다.';
  end if;
  if v_player.finished_at is not null then
    raise exception '이미 종료된 플레이입니다.';
  end if;

  v_values := v_player.values;
  v_mistakes := v_player.mistakes;
  v_wrong_attempts := coalesce(v_player.wrong_attempts, '{}'::jsonb);

  if p_value = 0 then
    v_values[p_cell + 1] := 0;
    v_accepted := true;
  elsif p_value = v_room.solution[p_cell + 1] then
    v_values[p_cell + 1] := p_value;
    v_accepted := true;
  else
    v_attempt_key := p_cell::text || ':' || p_value::text;
    if not (v_wrong_attempts ? v_attempt_key) then
      v_wrong_attempts := v_wrong_attempts || jsonb_build_object(v_attempt_key, true);
      v_mistakes := least(3, v_mistakes + 1);
      v_mistake_added := true;
    end if;
  end if;

  select count(*)::smallint into v_progress
  from generate_series(1, 81) s
  where v_room.puzzle[s] = 0
    and v_values[s] = v_room.solution[s];

  update public.sudoku_room_players
  set values = v_values,
      mistakes = v_mistakes,
      progress = v_progress,
      wrong_attempts = v_wrong_attempts
  where room_code = v_code and player_id = p_player_id;

  if v_mistakes >= 3 then
    update public.sudoku_room_players
    set finished_at = coalesce(finished_at, now())
    where room_code = v_code and player_id = p_player_id;

    if not exists (
      select 1 from public.sudoku_room_players
      where room_code = v_code and finished_at is null
    ) then
      update public.sudoku_rooms
      set status = 'finished', finished_at = coalesce(finished_at, now())
      where room_code = v_code;
    end if;
  elsif v_values = v_room.solution then
    v_seconds := greatest(0, extract(epoch from (now() - v_room.started_at))::integer);
    v_multiplier := case v_room.difficulty
      when 'veryEasy' then 1
      when 'easy' then 1.15
      when 'medium' then 1.35
      when 'hard' then 1.65
      when 'expert' then 2
      when 'master' then 2.4
      else 3
    end;
    v_score := greatest(
      100,
      round(1000 * v_multiplier - least(650, v_seconds * 0.55) - v_mistakes * 130)
    );

    update public.sudoku_room_players
    set finished_at = now(), score = v_score, progress = v_progress
    where room_code = v_code and player_id = p_player_id;

    update public.sudoku_rooms
    set status = 'finished', finished_at = now()
    where room_code = v_code;

    if v_player.rank_opt_in then
      insert into public.sudoku_rankings (
        player_id, nickname, mode, difficulty, score, seconds, mistakes
      ) values (
        p_player_id, v_player.nickname, 'competition', v_room.difficulty,
        v_score, v_seconds, v_mistakes
      );
    end if;
  end if;

  return private.sudoku_snapshot(v_code, p_player_id)
    || jsonb_build_object(
      'move_result', jsonb_build_object(
        'cell', p_cell,
        'value', p_value,
        'accepted', v_accepted,
        'mistake_added', v_mistake_added,
        'duplicate_wrong', (not v_accepted and not v_mistake_added)
      )
    );
end;
$function$;

revoke execute on function private.sudoku_candidate_is_valid(
  smallint[], integer, smallint
) from public;
revoke execute on function private.sudoku_count_solutions(
  smallint[], integer
) from public;
