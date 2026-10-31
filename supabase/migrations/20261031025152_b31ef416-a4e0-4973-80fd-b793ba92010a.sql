CREATE OR REPLACE FUNCTION public.guard_commission_settings()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.key IN ('community_creator_commission_percent', 'community_creator_commission_rules')
     AND NOT is_super_admin() THEN
    RAISE EXCEPTION 'Only the super admin can change community commission settings'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_commission_settings ON public.app_settings;
CREATE TRIGGER guard_commission_settings
BEFORE INSERT OR UPDATE ON public.app_settings
FOR EACH ROW EXECUTE FUNCTION public.guard_commission_settings();
