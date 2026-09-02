-- Problem 3: certificate verification.
-- Menu + screen entries for the certificate pages. AppRoot gates every route
-- through the user's permission data, so a page is unreachable until its path
-- exists here. Admins receive every access_controls row automatically.
--
-- The unique constraint is on (path, method) and method is NULL for screens.
-- NULLs never compare equal in Postgres, so ON CONFLICT cannot dedupe these;
-- the explicit NOT EXISTS guard is what makes re-running this file safe.

INSERT INTO access_controls (name, path, icon, parent_path, hierarchy_id, type, method)
SELECT v.name, v.path, v.icon, v.parent_path, v.hierarchy_id, v.type, NULL
FROM (VALUES
    ('Certificates',       'certificates_parent', 'rolesAndPermissions.svg', NULL,                  8, 'menu-screen'),
    ('Certificate List',   'certificates',         NULL,                     'certificates_parent', 1, 'menu-screen'),
    ('Issue Certificate',  'certificates/issue',   NULL,                     'certificates_parent', 2, 'menu-screen'),
    ('Verify Certificate', 'certificates/verify',  NULL,                     'certificates_parent', 3, 'menu-screen')
) AS v(name, path, icon, parent_path, hierarchy_id, type)
WHERE NOT EXISTS (
    SELECT 1 FROM access_controls ac WHERE ac.path = v.path
);
