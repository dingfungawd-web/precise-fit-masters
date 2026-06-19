
REVOKE EXECUTE ON FUNCTION public.get_email_by_employee_id(text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.get_email_by_employee_id(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_email_by_employee_id(text) TO anon;
