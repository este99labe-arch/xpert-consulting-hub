-- Reinstall the original TEMP key that was actually used to encrypt existing data.
-- The previous setup installed a different key, breaking decryption.
SELECT public._install_encryption_key('xpert_default_dev_key_REPLACE_IN_PRODUCTION_2026');