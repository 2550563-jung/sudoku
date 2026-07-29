-- Fix multiplayer answer validation, room lifecycle, and malformed input handling.
-- The public RPCs remain SECURITY DEFINER intentionally: clients are anonymous and
-- authenticate room actions with per-player session tokens. Base tables stay closed by RLS.

ALTER TABLE public.sudoku_room_players
  ADD COLUMN IF NOT EXISTS left_at timestamptz;

CREATE OR REPLACE FUNCTION private.sudoku_valid_token(
  p_room_code text,
  p_player_id uuid,
  p_token text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
  select exists (
    select 1
    from public.sudoku_room_players p
    where p.room_code = upper(trim(p_room_code))
      and p.player_id = p_player_id
      and p.left_at is null
      and p.token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
  );
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

  if (
    select count(*)
    from generate_series(1, 81) s
    where new.puzzle[s] = 0
  ) <> v_expected_holes then
    raise exception '난이도와 빈칸 수가 일치하지 않습니다.';
  end if;

  if exists (
    select 1
    from generate_series(0, 8) row_number
    where (
      select count(distinct new.solution[row_number * 9 + column_number + 1])
      from generate_series(0, 8) column_number
    ) <> 9
  ) or exists (
    select 1
    from generate_series(0, 8) column_number
    where (
      select count(distinct new.solution[row_number * 9 + column_number + 1])
      from generate_series(0, 8) row_number
    ) <> 9
  ) or exists (
    select 1
    from generate_series(0, 8) box_number
    where (
      select count(distinct new.solution[
        ((box_number / 3) * 3 + cell_number / 3) * 9
        + (box_number % 3) * 3
        + cell_number % 3
        + 1
      ])
      from generate_series(0, 8) cell_number
    ) <> 9
  ) then
    raise exception '올바른 스도쿠 해답이 아닙니다.';
  end if;

  return new;
end;
$function$;


CREATE OR REPLACE FUNCTION public.sudoku_create_room_v1(p_mode text, p_difficulty text, p_nickname text, p_puzzle smallint[], p_solution smallint[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_code text;
  v_player_id uuid := gen_random_uuid();
  v_token text := encode(extensions.gen_random_bytes(24), 'hex');
  v_nickname text := trim(p_nickname);
  v_try integer := 0;
begin
  if p_mode is distinct from 'competition' then
    raise exception '현재는 경쟁 모드만 지원합니다.';
  end if;
  if p_difficulty is null
     or p_difficulty not in ('veryEasy', 'easy', 'medium', 'hard', 'expert', 'master', 'extreme') then
    raise exception '지원하지 않는 난이도입니다.';
  end if;
  if v_nickname is null or char_length(v_nickname) not between 2 and 16 then
    raise exception '닉네임은 2~16자여야 합니다.';
  end if;
  if p_puzzle is null
     or p_solution is null
     or array_ndims(p_puzzle) <> 1
     or array_lower(p_puzzle, 1) <> 1
     or array_upper(p_puzzle, 1) <> 81
     or array_ndims(p_solution) <> 1
     or array_lower(p_solution, 1) <> 1
     or array_upper(p_solution, 1) <> 81 then
    raise exception '퍼즐 데이터가 올바르지 않습니다.';
  end if;
  if exists (
    select 1
    from generate_series(1, 81) s
    where p_solution[s] is null
       or p_solution[s] not between 1 and 9
       or p_puzzle[s] is null
       or p_puzzle[s] not between 0 and 9
       or (p_puzzle[s] <> 0 and p_puzzle[s] <> p_solution[s])
  ) then
    raise exception '퍼즐과 해답이 일치하지 않습니다.';
  end if;

  loop
    v_try := v_try + 1;
    v_code := upper(substr(encode(extensions.gen_random_bytes(5), 'hex'), 1, 8));
    begin
      insert into public.sudoku_rooms (
        room_code, mode, difficulty, puzzle, solution, board, host_player_id
      ) values (
        v_code, p_mode, p_difficulty, p_puzzle, p_solution, p_puzzle, v_player_id
      );
      exit;
    exception
      when unique_violation then
        if v_try >= 8 then
          raise exception '방 코드를 만들지 못했습니다. 다시 시도해 주세요.';
        end if;
    end;
  end loop;

  insert into public.sudoku_room_players (
    player_id, room_code, nickname, token_hash, values
  ) values (
    v_player_id,
    v_code,
    v_nickname,
    encode(extensions.digest(v_token, 'sha256'), 'hex'),
    p_puzzle
  );

  return jsonb_build_object(
    'player_id', v_player_id,
    'session_token', v_token,
    'snapshot', private.sudoku_snapshot(v_code, v_player_id)
  );
end;
$function$;


CREATE OR REPLACE FUNCTION public.sudoku_join_room_v1(p_room_code text, p_nickname text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_code text := upper(trim(p_room_code));
  v_nickname text := trim(p_nickname);
  v_room public.sudoku_rooms;
  v_player_id uuid := gen_random_uuid();
  v_token text := encode(extensions.gen_random_bytes(24), 'hex');
begin
  if v_code is null or v_code !~ '^[A-F0-9]{8}$' then
    raise exception '방 코드가 올바르지 않습니다.';
  end if;
  if v_nickname is null or char_length(v_nickname) not between 2 and 16 then
    raise exception '닉네임은 2~16자여야 합니다.';
  end if;

  select * into v_room
  from public.sudoku_rooms
  where room_code = v_code
  for update;

  if not found or v_room.expires_at <= now() then
    raise exception '방을 찾을 수 없거나 만료되었습니다.';
  end if;
  if v_room.status <> 'waiting' then
    raise exception '이미 시작된 방입니다.';
  end if;
  if (select count(*) from public.sudoku_room_players where room_code = v_code) >= 2 then
    raise exception '2인 방이 가득 찼습니다.';
  end if;

  insert into public.sudoku_room_players (
    player_id, room_code, nickname, token_hash, values
  ) values (
    v_player_id,
    v_code,
    v_nickname,
    encode(extensions.digest(v_token, 'sha256'), 'hex'),
    v_room.puzzle
  );

  return jsonb_build_object(
    'player_id', v_player_id,
    'session_token', v_token,
    'snapshot', private.sudoku_snapshot(v_code, v_player_id)
  );
exception
  when unique_violation then
    raise exception '이미 사용 중인 닉네임입니다.';
end;
$function$;


CREATE OR REPLACE FUNCTION public.sudoku_leave_room_v1(p_room_code text, p_player_id uuid, p_session_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_code text := upper(trim(p_room_code));
  v_room_status text;
  v_player_finished_at timestamptz;
begin
  if not private.sudoku_valid_token(v_code, p_player_id, p_session_token) then
    raise exception '참가자 인증에 실패했습니다.';
  end if;

  select r.status, p.finished_at
  into v_room_status, v_player_finished_at
  from public.sudoku_rooms r
  join public.sudoku_room_players p
    on p.room_code = r.room_code
   and p.player_id = p_player_id
  where r.room_code = v_code
  for update of r, p;

  if not found then
    raise exception '방 또는 참가자를 찾을 수 없습니다.';
  end if;

  if v_player_finished_at is not null then
    update public.sudoku_room_players
    set left_at = now()
    where room_code = v_code and player_id = p_player_id;

    if v_room_status = 'finished'
       and not exists (
         select 1
         from public.sudoku_room_players
         where room_code = v_code and left_at is null
       ) then
      delete from public.sudoku_rooms
      where room_code = v_code;
    end if;

    return jsonb_build_object('status', 'left');
  end if;

  delete from public.sudoku_rooms
  where room_code = v_code;

  return jsonb_build_object('status', 'closed');
end;
$function$;


CREATE OR REPLACE FUNCTION public.sudoku_place_number_v1(p_room_code text, p_player_id uuid, p_session_token text, p_cell integer, p_value smallint)
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

  if p_value = 0 then
    v_values[p_cell + 1] := 0;
  elsif p_value <> v_room.solution[p_cell + 1] then
    v_mistakes := least(3, v_mistakes + 1);
  else
    v_values[p_cell + 1] := p_value;
  end if;

  select count(*)::smallint into v_progress
  from generate_series(1, 81) s
  where v_room.puzzle[s] = 0
    and v_values[s] = v_room.solution[s];

  update public.sudoku_room_players
  set values = v_values, mistakes = v_mistakes, progress = v_progress
  where player_id = p_player_id;

  if v_mistakes >= 3 then
    update public.sudoku_room_players
    set finished_at = coalesce(finished_at, now())
    where player_id = p_player_id;

    if not exists (
      select 1
      from public.sudoku_room_players
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
    where player_id = p_player_id;

    update public.sudoku_rooms
    set status = 'finished', finished_at = now()
    where room_code = v_code;

    insert into public.sudoku_rankings (
      player_id, nickname, mode, difficulty, score, seconds, mistakes
    ) values (
      p_player_id, v_player.nickname, 'competition', v_room.difficulty,
      v_score, v_seconds, v_mistakes
    );
  end if;

  return private.sudoku_snapshot(v_code, p_player_id);
end;
$function$;


CREATE OR REPLACE FUNCTION public.sudoku_submit_single_score_v1(p_nickname text, p_difficulty text, p_seconds integer, p_mistakes smallint, p_hints_used smallint)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_nickname text := trim(p_nickname);
  v_multiplier numeric;
  v_score integer;
begin
  if v_nickname is null or char_length(v_nickname) not between 2 and 16 then
    raise exception '닉네임은 2~16자여야 합니다.';
  end if;
  if p_difficulty is null
     or p_difficulty not in ('veryEasy', 'easy', 'medium', 'hard', 'expert', 'master', 'extreme') then
    raise exception '지원하지 않는 난이도입니다.';
  end if;
  if p_seconds is null
     or p_mistakes is null
     or p_hints_used is null
     or p_seconds not between 0 and 86400
     or p_mistakes not between 0 and 2
     or p_hints_used not between 0 and 81 then
    raise exception '플레이 기록이 올바르지 않습니다.';
  end if;

  v_multiplier := case p_difficulty
    when 'veryEasy' then 1
    when 'easy' then 1.15
    when 'medium' then 1.35
    when 'hard' then 1.65
    when 'expert' then 2
    when 'master' then 2.4
    else 3
  end;
  v_score := greatest(100, round(
    1000 * v_multiplier
    - least(650, p_seconds * 0.55)
    - p_mistakes * 130
    - p_hints_used * 90
  ));

  insert into public.sudoku_rankings (
    player_id, nickname, mode, difficulty, score, seconds, mistakes
  ) values (
    gen_random_uuid(), v_nickname, 'single', p_difficulty,
    v_score, p_seconds, p_mistakes
  );

  return v_score;
end;
$function$;

revoke execute on function private.sudoku_snapshot(text, uuid) from public;
revoke execute on function private.sudoku_valid_token(text, uuid, text) from public;
revoke execute on function private.sudoku_validate_room_puzzle() from public;

revoke all on function public.sudoku_leave_room_v1(text, uuid, text) from public, authenticated;
grant execute on function public.sudoku_leave_room_v1(text, uuid, text) to anon, service_role;
