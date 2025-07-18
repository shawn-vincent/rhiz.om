-- Creates the default space '@intraliminal' if it does not already exist.
-- This space is self-owned and self-contained.
INSERT INTO "rhiz.om_being" (id, name, type, "ownerId", "locationId")
VALUES ('@intraliminal', 'Intraliminal Space', 'space', '@intraliminal', '@intraliminal')
ON CONFLICT (id) DO NOTHING;

