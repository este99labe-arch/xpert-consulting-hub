-- Los departamentos se venían escribiendo como texto libre en
-- employee_profiles.department, mientras la tabla departments y su FK
-- department_id quedaban sin usar (1 de 9 empleados). Con dos sitios para el
-- mismo dato, la herencia de marcas por departamento no tendría de dónde
-- tirar: sería decorativa.
--
-- Se crean los departamentos que faltan a partir de los textos existentes y se
-- enlaza el FK. La columna de texto se conserva porque hay históricos y
-- solicitudes de cambio de perfil que la referencian.

INSERT INTO public.departments (account_id, name)
SELECT DISTINCT ep.account_id, btrim(ep.department)
FROM public.employee_profiles ep
WHERE ep.department IS NOT NULL
  AND btrim(ep.department) <> ''
  AND NOT EXISTS (
    SELECT 1 FROM public.departments d
    WHERE d.account_id = ep.account_id
      AND lower(btrim(d.name)) = lower(btrim(ep.department))
  );

UPDATE public.employee_profiles ep
   SET department_id = d.id
  FROM public.departments d
 WHERE d.account_id = ep.account_id
   AND lower(btrim(d.name)) = lower(btrim(ep.department))
   AND ep.department_id IS NULL;

-- Un departamento no debería repetirse dentro de una cuenta.
CREATE UNIQUE INDEX IF NOT EXISTS departments_unique_name_per_account
  ON public.departments (account_id, lower(btrim(name)));
