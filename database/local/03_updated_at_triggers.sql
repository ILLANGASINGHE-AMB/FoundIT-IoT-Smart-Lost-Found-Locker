BEGIN;

-- Function that sets the new modification time.
CREATE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- Run the function before updating a lost report.
CREATE TRIGGER lost_items_updated_at
BEFORE UPDATE ON public.lost_items
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

-- Run the same function before updating a found report.
CREATE TRIGGER found_items_updated_at
BEFORE UPDATE ON public.found_items
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

COMMIT;