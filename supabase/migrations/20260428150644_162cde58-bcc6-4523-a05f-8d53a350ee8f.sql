
-- Encryption internals: only DB owner / postgres should call these
REVOKE EXECUTE ON FUNCTION public._get_encryption_key() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._install_encryption_key(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._encrypt_text(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._decrypt_text(bytea) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._hash_search(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.reencrypt_all_with_key(text, text) FROM PUBLIC, anon, authenticated;

-- Decrypted-data accessors: enforce internal checks but block anon explicitly
REVOKE EXECUTE ON FUNCTION public.get_decrypted_account(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_decrypted_business_client(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_decrypted_employee_profile(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.list_business_clients_decrypted(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.list_client_contacts_decrypted(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.list_employee_profiles_decrypted(uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.get_decrypted_account(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_decrypted_business_client(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_decrypted_employee_profile(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_business_clients_decrypted(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_client_contacts_decrypted(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_employee_profiles_decrypted(uuid) TO authenticated;

-- Audit logging RPC: only logged-in users
REVOKE EXECUTE ON FUNCTION public.log_audit_event(text, text, uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.log_audit_event(text, text, uuid, jsonb) TO authenticated;

-- Invoice KPIs and xred RPCs
REVOKE EXECUTE ON FUNCTION public.invoice_kpis(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.invoice_kpis(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.xred_resolve_names(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.xred_resolve_names(uuid[]) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.xred_is_match_participant(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.xred_is_match_participant(uuid, uuid) TO authenticated;
