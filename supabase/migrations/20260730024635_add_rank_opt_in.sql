-- Let each player choose whether this match may be added to public rankings.
-- The safe default is opt-out; clients must explicitly opt in for each match.

ALTER TABLE public.sudoku_room_players
  ADD COLUMN IF NOT EXISTS rank_opt_in boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.sudoku_set_rank_opt_in_v1(
  p_room_code text,
  p_player_id uuid,
  p_session_token text,
  p_rank_opt_in boolean
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
declare
  v_code text := upper(trim(p_room_code));
begin
  if p_rank_opt_in is null then
    raise exception '랭킹 등록 여부가 올바르지 않습니다.';
  end if;
  if not private.sudoku_valid_token(v_code, p_player_id, p_session_token) then
    raise exception '참가자 인증에 실패했습니다.';
  end if;

  update public.sudoku_room_players p
  set rank_opt_in = p_rank_opt_in
  from public.sudoku_rooms r
  where p.room_code = v_code
    and p.player_id = p_player_id
    and p.finished_at is null
    and r.room_code = p.room_code
    and r.status in ('waiting', 'playing');

  if not found then
    raise exception '진행 전 또는 진행 중인 참가자만 랭킹 설정을 바꿀 수 있습니다.';
  end if;

  return p_rank_opt_in;
end;
$function$;

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

    if v_player.rank_opt_in then
      insert into public.sudoku_rankings (
        player_id, nickname, mode, difficulty, score, seconds, mistakes
      ) values (
        p_player_id, v_player.nickname, 'competition', v_room.difficulty,
        v_score, v_seconds, v_mistakes
      );
    end if;
  end if;

  return private.sudoku_snapshot(v_code, p_player_id);
end;
$function$;

revoke all on function public.sudoku_set_rank_opt_in_v1(
  text, uuid, text, boolean
) from public, authenticated;
grant execute on function public.sudoku_set_rank_opt_in_v1(
  text, uuid, text, boolean
) to anon, service_role;
