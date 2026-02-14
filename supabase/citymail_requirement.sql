-- Service Approval Setting for Citymail Email Requirement
-- When 'open' is true: Only emails ending with @citymail.cuny.edu or @ccny.cuny.edu are allowed
-- When 'open' is false: Any email domain is allowed

INSERT INTO "public"."service_approval" ("id", "created_at", "open", "name") 
VALUES (
  '6', 
  NOW(), 
  'true', 
  'True: Citymail mandatory, False: No Citymail Required'
)
ON CONFLICT (id) 
DO UPDATE SET 
  open = EXCLUDED.open,
  name = EXCLUDED.name;
