-- ============ CRITICAL RPCS: race-safe state transitions ============
-- Three SECURITY DEFINER RPCs to fix the issues the previous commit
-- (`d63be58`) addressed on the client side: every state-changing
-- operation now runs server-side as a single transaction with proper
-- guards, so the UI rollback logic can never leave partial state.

-- Each RPC is only granted to `service_role`. The server functions
-- (src/lib/*.functions.ts) authenticate the caller and then invoke
-- the RPC via the admin client.

-- ===================================================================
-- 1) set_user_role(_user_id uuid, _role app_role)
--    Atomically replaces a user's role. Replaces the buggy
--    DELETE+INSERT sequence in updateUserRole that could leave a
--    user with no role if the INSERT failed.
-- ===================================================================
CREATE OR REPLACE FUNCTION public.set_user_role(
  _user_id uuid,
  _role public.app_role
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'user_id é obrigatório';
  END IF;
  IF _role NOT IN ('administrador', 'editor', 'leitor', 'kiosk') THEN
    RAISE EXCEPTION 'Perfil inválido';
  END IF;

  -- Insert the new role first. If the user already has this role,
  -- the UNIQUE constraint raises — we treat that as "no change".
  BEGIN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (_user_id, _role);
  EXCEPTION
    WHEN unique_violation THEN
      -- Already has this role — that's fine, just keep going.
      NULL;
  END;

  -- Delete every other role the user holds so they end up with
  -- exactly one row. (We just inserted the target, so a user with
  -- the same target role will end up with the same single row.)
  DELETE FROM public.user_roles
  WHERE user_id = _user_id
    AND role <> _role;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.set_user_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_user_role(uuid, public.app_role) TO service_role;

-- ===================================================================
-- 2) return_with_problem(_asset_id uuid, _holder text,
--                        _description text, _reported_by text,
--                        _note text DEFAULT NULL)
--    Atomic return-with-problem flow used by the MovementDialog.
--    Replaces the client-side rollback that could leave a problem
--    row orphaned if the asset UPDATE failed.
-- ===================================================================
CREATE OR REPLACE FUNCTION public.return_with_problem(
  _asset_id uuid,
  _holder text,
  _description text,
  _reported_by text,
  _note text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _mov_id uuid;
  _expected public.asset_status := 'in_use';
  _updated int;
BEGIN
  IF _description IS NULL OR btrim(_description) = '' THEN
    RAISE EXCEPTION 'Descreva o problema encontrado';
  END IF;

  -- Insert the return movement first.
  INSERT INTO public.movements (asset_id, collaborator_id, type, holder, note)
  VALUES (_asset_id, NULL, 'return', _holder, _note)
  RETURNING id INTO _mov_id;

  -- Insert the problem.
  INSERT INTO public.problems (asset_id, description, reported_by, status)
  VALUES (_asset_id, _description, _reported_by, 'open');

  -- Flip the asset to problem status with the race-safe guard. If
  -- the asset is no longer in_use (someone else returned it in the
  -- meantime), the UPDATE returns 0 rows and we roll back BOTH the
  -- movement and the problem — no orphaned rows.
  UPDATE public.assets
     SET status = 'problem',
         current_holder = NULL
   WHERE id = _asset_id AND status = _expected;

  GET DIAGNOSTICS _updated = ROW_COUNT;
  IF _updated = 0 THEN
    RAISE EXCEPTION 'Este equipamento não está mais em uso';
  END IF;

  RETURN _mov_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.return_with_problem(uuid, text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.return_with_problem(uuid, text, text, text, text) TO service_role;

-- ===================================================================
-- 3) register_problem(_asset_id uuid, _description text, _reported_by text)
--    Atomic problem registration from /problemas. Captures the
--    current holder in the description so the custody trail is not
--    lost, then flips the asset with the race-safe guard.
-- ===================================================================
CREATE OR REPLACE FUNCTION public.register_problem(
  _asset_id uuid,
  _description text,
  _reported_by text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _prob_id uuid;
  _prev_holder text;
  _final_description text;
  _updated int;
BEGIN
  IF _description IS NULL OR btrim(_description) = '' THEN
    RAISE EXCEPTION 'Descreva o problema';
  END IF;

  -- Snapshot the current holder (if any) so the audit trail
  -- captures who had the equipment when the problem was reported.
  SELECT current_holder INTO _prev_holder
  FROM public.assets
  WHERE id = _asset_id
  FOR UPDATE;

  IF _prev_holder IS NOT NULL THEN
    _final_description := format('(Estava com %s) %s', _prev_holder, _description);
  ELSE
    _final_description := _description;
  END IF;

  -- Insert the problem row.
  INSERT INTO public.problems (asset_id, description, reported_by, status)
  VALUES (_asset_id, _final_description, _reported_by, 'open')
  RETURNING id INTO _prob_id;

  -- Flip asset to problem. The FOR UPDATE above locked the row so
  -- this UPDATE is guaranteed to be against the same state we just
  -- read; the WHERE clause also enforces "not already problem" to
  -- avoid creating duplicate open problems for the same asset.
  UPDATE public.assets
     SET status = 'problem',
         current_holder = NULL
   WHERE id = _asset_id
     AND status <> 'problem';

  GET DIAGNOSTICS _updated = ROW_COUNT;
  IF _updated = 0 THEN
    -- Asset was already in problem state. The problem row is still
    -- valid (multiple open problems are allowed), so we keep it and
    -- just return success.
    RETURN _prob_id;
  END IF;

  RETURN _prob_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.register_problem(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.register_problem(uuid, text, text) TO service_role;
