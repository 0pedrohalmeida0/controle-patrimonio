
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_movement_shift() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_asset_code() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.movement_shift(timestamp with time zone) FROM PUBLIC, anon, authenticated;
